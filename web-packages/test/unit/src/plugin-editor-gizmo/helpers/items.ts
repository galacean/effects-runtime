import { type TestSpy } from './spies';
import { spec, type VFXItem } from '@galacean/effects';
import { Matrix4, Vector2, type Matrix3 } from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';

// Power-of-two dimensions keep pixel coordinates exact through projection.
export const TEST_VIEW_SIZE = new Vector2(1024, 1024);

/** Camera fixture that projects world pixel coordinates into the same view pixels. */
export function createPixelCamera (size: Vector2 = TEST_VIEW_SIZE) {
  return {
    getProjectionMatrix: () => new Matrix4().setFromRowMajorData(
      2 / size.x, 0, 0, -1,
      0, -2 / size.y, 0, 1,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ),
    getViewMatrix: () => new Matrix4(),
  };
}

/** Give a fixture item a real transform and camera instead of replacing module exports. */
export function setItemViewTransform (
  item: VFXItem,
  transform: Matrix3 | (() => Matrix3 | undefined) | undefined,
  size: Vector2 = TEST_VIEW_SIZE,
): TestSpy {
  const projection = chai.spy(typeof transform === 'function' ? transform : () => transform);

  Object.assign(item, {
    type: item.type ?? spec.ItemType.sprite,
    name: item.name ?? '',
    isVisible: item.isVisible ?? true,
    children: item.children ?? [],
    getComponent: item.getComponent ?? (() => undefined),
    transform: {
      size: new Vector2(1, 1),
      updateLocalMatrix: chai.spy(),
      getWorldMatrix: () => {
        const view = projection();

        if (!view) {
          return new Matrix4().setFromScale(0, 0, 0);
        }
        const e = view.elements;

        // Item corners use centered, Y-up local coordinates; view transforms
        // use a normalized box with its origin at the top-left corner.
        return new Matrix4().setFromRowMajorData(
          e[0], -e[3], 0, e[6] + (e[0] + e[3]) / 2,
          e[1], -e[4], 0, e[7] + (e[1] + e[4]) / 2,
          0, 0, 1, 0,
          0, 0, 0, 1,
        );
      },
    },
    composition: {
      transform: { getWorldMatrix: () => new Matrix4() },
      camera: createPixelCamera(size),
    },
  });

  return projection;
}
