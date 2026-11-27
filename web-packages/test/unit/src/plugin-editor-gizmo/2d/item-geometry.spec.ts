import { restoreTestState } from '../helpers/spies';
import { createPixelCamera, TEST_VIEW_SIZE } from '../helpers/items';

import { FrameComponent, ShapeComponent, spec, type VFXItem } from '@galacean/effects';
import { Box3 } from '@galacean/effects-math/es/core/box3';
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
    pathBounds?: Box3,
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
      getComponent: (component: unknown) => {
        if (component === FrameComponent && frameComponent) {
          return {};
        }
        if (component === ShapeComponent && options.pathBounds) {
          return { getBoundingBox: () => options.pathBounds };
        }

        return undefined;
      },
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

      expect(getTransformedBoxCorners(transform)).to.deep.equal(getBoxCorners(bounds));
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

    it('uses ShapeComponent bounds instead of transform.size for custom paths', () => {
      const item = createItem({
        type: spec.ItemType.shape,
        size: new Vector2(20, 20),
        pathBounds: new Box3(new Vector3(-80, -20, 0), new Vector3(40, 40, 0)),
      });
      const bounds = getItemViewBox(item, TEST_VIEW_SIZE.clone());

      expect(bounds.min.x).to.be.closeTo(-80, 0.5 * 10 ** -(2));
      expect(bounds.max.x).to.be.closeTo(40, 0.5 * 10 ** -(2));
      expect(bounds.min.y).to.be.closeTo(-20, 0.5 * 10 ** -(2));
      expect(bounds.max.y).to.be.closeTo(40, 0.5 * 10 ** -(2));
    });

    for (const axis of ['x', 'y'] as const) {
      it(`keeps a straight ${axis} path selectable after rotation`, () => {
        const pathBounds = axis === 'x'
          ? new Box3(new Vector3(-80, 0, 0), new Vector3(40, 0, 0))
          : new Box3(new Vector3(0, -80, 0), new Vector3(0, 40, 0));
        const item = createItem({ type: spec.ItemType.shape, pathBounds, rotation: 45 });
        const transform = getItemViewTransform(item, TEST_VIEW_SIZE.clone())!;
        const bounds = getItemViewBox(item, TEST_VIEW_SIZE.clone());
        const corners = getTransformedBoxCorners(transform);

        expect(bounds.isEmpty()).equals(false);
        expect(corners[0].distance(corners[axis === 'x' ? 3 : 1])).lessThan(1e-8);
        expect(corners[0].distance(corners[2])).closeTo(120, 1e-8);
        expect(transformedBoxContainsPoint(transform, corners[0])).equals(true);
        expect(transformedBoxContainsPoint(transform, bounds.max.clone().add(new Vector2(10, 10)))).equals(false);
      });
    }
  });
});
