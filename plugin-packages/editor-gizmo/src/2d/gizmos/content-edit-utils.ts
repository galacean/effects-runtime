import type { VFXItem } from '@galacean/effects';
import { Matrix4, Vector2, Vector3 } from '../../math';
import { projectPoint } from '../viewport';

export function viewportSize (item: VFXItem): Vector2 {
  const canvas = item.engine.canvas;

  return new Vector2(canvas.clientWidth, canvas.clientHeight);
}

export function localToView (item: VFXItem, point: Vector3, matrix = item.transform.getWorldMatrix()): Vector2 {
  return projectPoint(point.clone().applyMatrix(matrix), item, viewportSize(item));
}

/** 在目标自身的平面求交，支持旋转、非等比缩放和透视。奇异变换不写入。 */
export function viewToLocal (
  item: VFXItem,
  point: Vector2,
  z = 0,
  matrix = item.transform.getWorldMatrix(),
): Vector3 | undefined {
  const camera = item.composition?.camera;
  const size = viewportSize(item);

  if (!camera || size.x <= 0 || size.y <= 0 || Math.abs(matrix.determinant()) < 1e-10) {
    return;
  }
  const inverse = new Matrix4().copyFrom(matrix).invert();
  const x = point.x / size.x * 2 - 1;
  const y = 1 - point.y / size.y * 2;
  const vp = camera.getInverseViewProjectionMatrix();
  const near = new Vector3(x, y, -1).applyProjectionMatrix(vp).applyMatrix(inverse);
  const far = new Vector3(x, y, 1).applyProjectionMatrix(vp).applyMatrix(inverse);
  const direction = far.subtract(near);

  if (Math.abs(direction.z) < 1e-8) {
    return;
  }
  const result = near.add(direction.multiply((z - near.z) / direction.z));

  return [result.x, result.y, result.z].every(Number.isFinite) ? result : undefined;
}

/** 一组点共同吸附；每个轴只选一次最近修正，避免逐点覆盖结果。 */
export function snapTranslation (sources: Vector2[], targets: Vector2[], delta: Vector2): Vector2 {
  const offset = new Vector2();
  let dx = 6;
  let dy = 6;

  for (const source of sources) {
    for (const target of targets) {
      const x = target.x - source.x - delta.x;
      const y = target.y - source.y - delta.y;

      if (Math.abs(x) < dx) {
        dx = Math.abs(x);
        offset.x = x;
      }
      if (Math.abs(y) < dy) {
        dy = Math.abs(y);
        offset.y = y;
      }
    }
  }

  return delta.clone().add(offset);
}
