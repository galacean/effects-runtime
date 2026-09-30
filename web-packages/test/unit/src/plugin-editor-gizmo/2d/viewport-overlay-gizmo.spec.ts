import { restoreTestState } from '../helpers/spies';
import { setItemViewTransform, TEST_VIEW_SIZE } from '../helpers/items';
import { FrameComponent, spec, type Engine, type VFXItem } from '@galacean/effects';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxTransformFromBox } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import type { GizmoOwner } from '../../../../../../plugin-packages/editor-gizmo/src/2d';
import { ViewportOverlayGizmo } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/viewport-overlay-gizmo';

const { expect } = chai;

describe('plugin-editor-gizmo/viewport-overlay-gizmo', () => {
  afterEach(restoreTestState);

  function createViewportOverlayGizmo (): ViewportOverlayGizmo {
    const maskFrame = {
      type: spec.ItemType.null,
      name: '主合成蒙版',
      getComponent: (component: unknown) => component === FrameComponent ? {} : undefined,
    } as unknown as VFXItem;

    setItemViewTransform(maskFrame, getBoxTransformFromBox(new Box2(new Vector2(100, 100), new Vector2(500, 800))));
    const composition = {
      items: [maskFrame],
      camera: {
        getViewportMatrix: () => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
      },
    };
    const engine = {
      canvas: { parentElement: { offsetWidth: TEST_VIEW_SIZE.x, offsetHeight: TEST_VIEW_SIZE.y } },
      sceneServer: { compositions: [composition] },
    } as unknown as Engine;
    const owner = { getEngine: () => engine } as GizmoOwner;

    return new ViewportOverlayGizmo(owner);
  }

  describe('ViewportOverlayGizmo - box 不依赖 viewProperty(根因回归)', () => {
  // 根因:原 onUpdate() 把 viewProperty 守卫放在 box 查找之前,viewProperty 空就 box=空 return,
  // 遮断蒙版 item 投影。State 切换重建 config 实例后 viewProperty 尚未重灌时,红框整体消失。
    it('viewProperty 为 undefined 时,onUpdate 仍走蒙版 item 查找并写入非空 box', () => {
      const gizmo = createViewportOverlayGizmo();

      // 模拟 State 切换重建实例后的状态:viewProperty 为 undefined(gizmo 默认)
      expect(gizmo.viewProperty).to.equal(undefined);
      gizmo.onUpdate();

      expect(gizmo.box.isEmpty()).to.equal(false);
    });

    it('viewProperty 在时,onUpdate 同样算出 box(不回归)', () => {
      const gizmo = createViewportOverlayGizmo();

      gizmo.viewProperty = {
        size: [750, 1624],
        safeArea: [0, 0, 0, 0],
        previewSafeAreas: [],
      };
      gizmo.onUpdate();

      expect(gizmo.box.isEmpty()).to.equal(false);
    });

    it('无蒙版/画板 item 且无 viewProperty 时,box 置空(preview 投影回退分支守卫)', () => {
    // composition 无蒙版/画板 item,仅走 preview 投影回退,该回退依赖 viewProperty.size。
      const composition = {
        items: [{ type: spec.ItemType.sprite } as unknown as VFXItem],
        camera: {
          getViewportMatrix: () => ({ elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
        },
      };
      const engine = {
        canvas: { parentElement: { offsetWidth: TEST_VIEW_SIZE.x, offsetHeight: TEST_VIEW_SIZE.y } },
        sceneServer: { compositions: [composition] },
      } as unknown as Engine;
      const gizmo = new ViewportOverlayGizmo({ getEngine: () => engine } as GizmoOwner);

      expect(gizmo.viewProperty).to.equal(undefined);
      gizmo.onUpdate();

      expect(gizmo.box.isEmpty()).to.equal(true);
    });
  });
});
