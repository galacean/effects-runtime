import type { Transform } from '@galacean/effects';
import { math } from '@galacean/effects';

/** 读取与 setRotation 一致的本地欧拉角，兼容四元数直接更新。 */
export function getEditorRotation (transform: Transform): math.Euler {
  const rotation = new math.Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.order);
  const expected = new math.Quaternion().setFromEuler(rotation).conjugate();
  const actual = transform.quat;
  const dot = expected.x * actual.x + expected.y * actual.y + expected.z * actual.z + expected.w * actual.w;

  return Math.abs(dot) > 1 - 1e-8 ? rotation : rotation.setFromQuaternion(actual.clone().conjugate());
}
