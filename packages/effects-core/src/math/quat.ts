import type { vec3, vec4 } from '@galacean/effects-specification';
import { vec3Cross, vecAdd, vecDot } from './vec';

const d2r = Math.PI / 180;
const cos = Math.cos;
const sin = Math.sin;

export function quatMultiply (out: vec4 | number[], a: vec4, b: vec4): vec4 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];

  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];

  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;

  return out as vec4;
}

/**
 * 按照 ZYX 的旋转顺序把旋转角转换成四元数
 * @param out - 结果向量
 * @param x - 沿x轴旋转角度
 * @param y - 沿y轴旋转角度
 * @param z - 沿z轴旋转角度
 */
export function quatFromRotation (out: vec4 | number[], x: number, y: number, z: number) {
  const c1 = cos((x * d2r) / 2);
  const c2 = cos((y * d2r) / 2);
  const c3 = cos((z * d2r) / 2);

  const s1 = sin((x * d2r) / 2);
  const s2 = sin((y * d2r) / 2);
  const s3 = sin((z * d2r) / 2);

  out[0] = s1 * c2 * c3 - c1 * s2 * s3;
  out[1] = c1 * s2 * c3 + s1 * c2 * s3;
  out[2] = c1 * c2 * s3 - s1 * s2 * c3;
  out[3] = c1 * c2 * c3 + s1 * s2 * s3;
}

/**
 * 取四元数的共轭
 * @param out - 结果四元数
 * @param quat - 原始四元数
 */
export function quatStar (out: vec4 | number[], quat: vec4) {
  const x = quat[0], y = quat[1], z = quat[2], w = quat[3];

  out[0] = -x;
  out[1] = -y;
  out[2] = -z;
  out[3] = w;
}

/**
 * 根据指定四元数计算向量旋转后的结果
 * @param out - 结果向量
 * @param a - 原始向量
 * @param quat - 四元数
 */
export function rotateByQuat (out: vec3, a: vec3, quat: vec4) {
  const x = quat[0], y = quat[1], z = quat[2], w = quat[3];
  const qvec: vec3 = [x, y, z];
  const uv = vec3Cross([], qvec, a);
  const uuv = vec3Cross([], qvec, uv);

  vecDot(uuv, uuv, 2);
  vecDot(uv, uv, 2 * w);
  vecAdd(uuv, uuv, uv);
  vecAdd(out, a, uuv);
}
