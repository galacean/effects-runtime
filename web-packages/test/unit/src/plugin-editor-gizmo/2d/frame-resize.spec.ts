import { restoreTestState, getSpyCalls, type TestSpy } from '../helpers/spies';
import { FrameComponent, spec, type VFXItem } from '@galacean/effects';
import { Matrix4, Quaternion, Vector2, Vector3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { getItemWorldSize } from '../../../../../../plugin-packages/editor-gizmo/src/2d/items/item-geometry';
import { resizeFrameItem } from '../../../../../../plugin-packages/editor-gizmo/src/2d/frame/frame-resize';

const { expect } = chai;

describe('plugin-editor-gizmo/frame-resize', () => {
  afterEach(restoreTestState);

  function createFrame (
    localSize: Vector2,
    worldScale: Vector3,
  ): { frame: VFXItem, setSize: TestSpy } {
    const itemWorldMatrix = new Matrix4().compose(
      new Vector3(),
      new Quaternion(),
      worldScale,
    );
    const setSize = chai.spy();
    const frame = {
      type: spec.ItemType.null,
      name: '画板',
      getComponent: (component: unknown) => component === FrameComponent ? {} : undefined,
      transform: {
        size: localSize,
        position: new Vector3(),
        updateLocalMatrix: chai.spy(),
        getWorldMatrix: () => itemWorldMatrix,
        setSize,
      },
      composition: {
        transform: {
          getWorldMatrix: () => new Matrix4(),
        },
      },
      children: [],
      setPosition: chai.spy(),
    } as unknown as VFXItem;

    return { frame, setSize };
  }

  describe('Frame world-size resize', () => {
    it('按当前世界尺寸比例反算本地尺寸，不依赖 viewport zoom', () => {
      const { frame, setSize } = createFrame(
        new Vector2(100, 50),
        new Vector3(2, 3, 1),
      );

      // 当前实际世界尺寸为 200 × 150；目标世界尺寸扩大到 1.5 倍。
      expect(getItemWorldSize(frame)).to.deep.equal(new Vector2(200, 150));

      resizeFrameItem(frame, new Vector2(300, 225), new Vector3());

      // setSize 接受本地尺寸，因此应写回 150 × 75。
      // 整条路径不接收 camera/container/viewportMatrix，zoom 无法参与尺寸换算。
      expect(setSize).to.have.been.called.with.exactly(150, 75);
    });

    it('使用 pointer down 尺寸快照时可经过零并写入负尺寸镜像', () => {
      const initialLocalSize = new Vector2(100, 50);
      const initialWorldSize = new Vector2(200, 150);
      const { frame, setSize } = createFrame(initialLocalSize, new Vector3(2, 3, 1));

      resizeFrameItem(frame, new Vector2(0, 0), new Vector3(), {
        localSize: initialLocalSize,
        worldSize: initialWorldSize,
      });
      resizeFrameItem(frame, new Vector2(-100, -75), new Vector3(), {
        localSize: initialLocalSize,
        worldSize: initialWorldSize,
      });

      expect(getSpyCalls(setSize)).to.deep.equal([
        [0, 0],
        [-50, -25],
      ]);
    });
  });
});
