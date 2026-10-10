import { restoreTestState } from '../helpers/spies';
import { createPixelCamera, TEST_VIEW_SIZE } from '../helpers/items';

import { FrameComponent, spec, type VFXItem } from '@galacean/effects';
import { Euler, Matrix4, Quaternion, Vector2, Vector3, getBoxCorners, getTransformedBoxCorners, transformedBoxContainsPoint } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';
import { getItemViewBox, getItemViewTransform } from '../../../../../../plugin-packages/editor-gizmo/src/2d/items/item-geometry';

const { expect } = chai;

describe('plugin-editor-gizmo/item-geometry', () => {
  afterEach(restoreTestState);

  function createItem (options: {
    type?: spec.ItemType,
    name?: string,
    size?: Vector2,
    position?: Vector3,
    rotation?: number,
    children?: VFXItem[],
    frameComponent?: boolean,
    visible?: boolean,
  } = {}): VFXItem {
    const matrix = new Matrix4().compose(
      options.position ?? new Vector3(),
      new Quaternion().setFromEuler(new Euler(0, 0, options.rotation ?? 0)),
      new Vector3(1, 1, 1),
    );
    const frameComponent = options.frameComponent ?? false;

    return {
      type: options.type ?? spec.ItemType.sprite,
      name: options.name ?? '',
      isVisible: options.visible ?? true,
      children: options.children ?? [],
      getComponent: (component: unknown) => component === FrameComponent && frameComponent ? {} : undefined,
      transform: {
        size: options.size ?? new Vector2(100, 40),
        updateLocalMatrix: chai.spy(),
        getWorldMatrix: () => matrix,
      },
      composition: {
        camera: createPixelCamera(),
        transform: {
          getWorldMatrix: () => new Matrix4(),
        },
      },
    } as unknown as VFXItem;
  }

  describe('item Box2 projection', () => {
    it('keeps a leaf item oriented while deriving its AABB from the same projection', () => {
      const item = createItem({ rotation: 45 });
      const transform = getItemViewTransform(
        item,
        TEST_VIEW_SIZE.clone(),
      )!;
      const bounds = getItemViewBox(
        item,
        TEST_VIEW_SIZE.clone(),
      );

      expect(transformedBoxContainsPoint(transform, bounds.min)).to.equal(false);
      expect(transformedBoxContainsPoint(transform, bounds.getCenter())).to.equal(true);
    });

    it('collapses a container subtree to one AABB projection', () => {
      const group = createItem({
        type: spec.ItemType.null,
        children: [
          createItem({ position: new Vector3(-100, 0, 0), rotation: 30 }),
          createItem({ position: new Vector3(100, 0, 0), rotation: -30 }),
        ],
      });
      const transform = getItemViewTransform(group, TEST_VIEW_SIZE.clone())!;
      const bounds = getItemViewBox(group, TEST_VIEW_SIZE.clone());

      expect(getTransformedBoxCorners(transform).map(point => point.toArray()))
        .to.deep.equal(getBoxCorners(bounds).map(point => point.toArray()));
    });

    it('does not merge a framed item with its children', () => {
      const frame = createItem({
        type: spec.ItemType.null,
        frameComponent: true,
        size: new Vector2(100, 100),
        children: [createItem({ position: new Vector3(500, 0, 0) })],
      });
      const bounds = getItemViewBox(frame, TEST_VIEW_SIZE.clone());

      expect(bounds.min.x).to.be.closeTo(-50, 0.5 * 10 ** -(2));
      expect(bounds.max.x).to.be.closeTo(50, 0.5 * 10 ** -(2));
    });
  });
});
