import type { vec2, vec3, vec4 } from '@galacean/effects-specification';
import type { mat3, mat4 } from './types';
import { isArray } from '../utils';
import { clamp } from './utils';

const d2r = Math.PI / 180;
const r2d = 180 / Math.PI;
const cos = Math.cos;
const sin = Math.sin;

export type vec = number[];

export function vecAdd<T extends vec | vec3 | vec4 | vec2> (out: T | number[], a: T, b: T): T {
  for (let i = 0, len = a.length; i < len; i++) {
    out[i] = a[i] + b[i];
  }

  return out as T;
}

export function vecFill<T extends vec | vec3 | vec4 | vec2> (out: T | number[], number: number): T {
  for (let i = 0, len = out.length; i < len; i++) {
    out[i] = number;
  }

  return out as T;
}

export const NumberEpsilon = Number.EPSILON || Math.pow(2, -32);

export function isZeroVec (vec: vec): boolean {
  for (let i = 0, len = vec.length; i < len; i++) {
    if (Math.abs(vec[i]) > NumberEpsilon) {
      return false;
    }
  }

  return true;
}

export function ensureVec3 (num?: any): vec3 {
  return isArray(num) ? [num[0], num[1], num[2]] : [0, 0, 0];
}

export function vec3MulMat3 (out: vec3, a: vec3, m: mat3): vec3 {
  const x = a[0], y = a[1], z = a[2];

  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];

  return out;
}

export function vecAssign<T extends vec | vec3 | vec4 | vec2> (out: T | number[] | Float32Array, a: T, count: number, start = 0): T {
  for (let i = 0; i < count; i++) {
    out[i] = a[i + start];
  }

  return out as T;
}

export function vecMulCombine<T extends vec | vec3 | vec4 | vec2> (out: T | number[] | Float32Array, a?: T, b?: T): T {
  if (a && b) {
    for (let i = 0, len = a.length; i < len; i++) {
      out[i] = a[i] * b[i];
    }
  } else if (a) {
    if (out !== a) {
      for (let i = 0; i < a.length; i++) {
        out[i] = a[i];
      }
    }
  } else if (b) {
    if (out !== b) {
      for (let i = 0; i < b.length; i++) {
        out[i] = b[i];
      }
    }
  }

  return out as T;
}

export function vecNormalize<T extends vec | vec2 | vec3 | vec4> (
  out: T | number[],
  a?: T | number[],
): T {
  if (arguments.length === 1) {
    a = out;
    out = [];
  }
  const ap = a!;
  const sum = Math.hypot(...ap);

  if (sum === 0) {
    return vecAssign(out, ap, ap.length) as T;
  }
  for (let i = 0; i < ap.length; i++) {
    out[i] = ap[i] / sum;
  }

  return out as T;
}

export function vecMulScalar<T extends vec | vec3 | vec4 | vec2> (out: T | number[], vec: T, a: number): T {
  for (let i = 0, len = vec.length; i < len; i++) {
    out[i] = vec[i] * a;
  }

  return out as T;
}

export function vecMinus<T extends vec | vec3 | vec4 | vec2> (out: T | number[], v0: T, v1: T): T {
  for (let i = 0, len = v0.length; i < len; i++) {
    out[i] = v0[i] - v1[i];
  }

  return out as T;
}

export function vecSquareDistance (v0: vec, v1: vec): number {
  let sum = 0;

  for (let i = 0, len = v0.length; i < len; i++) {
    const d = v0[i] - v1[i];

    sum += d * d;
  }

  return sum;
}

type vecDotRes<T> = T extends vec ? number : vec;
export function vecDot<T extends number | vec = vec> (out: vec, a: vec, b?: T): vecDotRes<T> {
  if (isNaN(<number>b)) {
    let sum = 0;

    for (let i = 0, len = a.length; i < len; i++) {
      sum += out[i] * a[i];
    }

    return sum as vecDotRes<T>;
  }
  for (let i = 0, len = a.length; i < len; i++) {
    out[i] = a[i] * (b as number);
  }

  return (out) as vecDotRes<T>;
}

export function vec3Cross (out: vec3 | number[], a: vec3, b: vec3): vec3 {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];

  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;

  return out as vec3;
}

export function vec3MulMat4 (out: vec3 | number[], vec3: vec3, mat4: mat4): vec3 {
  const x = vec3[0], y = vec3[1], z = vec3[2];
  let w = mat4[3] * x + mat4[7] * y + mat4[11] * z + mat4[15];

  w = w || 1.0;
  out[0] = (mat4[0] * x + mat4[4] * y + mat4[8] * z + mat4[12]) / w;
  out[1] = (mat4[1] * x + mat4[5] * y + mat4[9] * z + mat4[13]) / w;
  out[2] = (mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14]) / w;

  return out as vec3;
}

export function vec3RotateByMat4 (out: vec3 | number[], a: vec3, m: mat4): vec3 {
  const x = a[0], y = a[1], z = a[2];
  const w = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1;

  out[0] = (m[0] * x + m[4] * y + m[8] * z) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z) / w;

  return out as vec3;
}

const tempMat3FromRotationZ: mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export function mat3FromRotationZ (out: mat3 | number[], rad: number): mat3 {
  if (!out) {
    out = tempMat3FromRotationZ;
  }
  const s = sin(rad);
  const c = cos(rad);

  out[0] = c;
  out[1] = s;
  out[2] = 0;
  out[3] = -s;
  out[4] = c;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;

  return out as mat3;
}

function mat3FromRotationZYX (ret: mat3 | number[], x: number, y: number, z: number): mat3 {
  const cosX = cos(x * d2r);
  const cosY = cos(y * d2r);
  const cosZ = cos(z * d2r);
  const sinX = sin(x * d2r);
  const sinY = sin(y * d2r);
  const sinZ = sin(z * d2r);

  ret[0] = cosY * cosZ;
  ret[1] = cosY * sinZ;
  ret[2] = -sinY;
  ret[3] = -cosX * sinZ + sinX * sinY * cosZ;
  ret[4] = cosX * cosZ + sinX * sinY * sinZ;
  ret[5] = sinX * cosY;
  ret[6] = sinZ * sinX + cosX * sinY * cosZ;
  ret[7] = -sinX * cosZ + cosX * sinY * sinZ;
  ret[8] = cosX * cosY;

  return ret as mat3;
}

export function mat3FromRotation (ret: mat3 | number[], rotation: vec3): mat3 {
  return mat3FromRotationZYX(ret, -rotation[0], -rotation[1], -rotation[2]);
}

function rotationZYXFromMat3 (out: vec3, mat3: mat3): vec3 {
  const te = mat3;
  const m11 = te[0], m12 = te[3], m13 = te[6];
  const m21 = te[1], m22 = te[4], m23 = te[7];
  const m31 = te[2], m32 = te[5], m33 = te[8];

  out[1] = Math.asin(clamp(-m31, -1, 1)) * r2d;
  if (Math.abs(m31) < 0.9999999) {
    out[0] = Math.atan2(m32, m33) * r2d;
    out[2] = Math.atan2(m21, m11) * r2d;
  } else {
    out[0] = 0;
    out[2] = Math.atan2(-m12, m22) * r2d;
  }

  return out;
}

export function rotationFromMat3 (out: vec3, mat3: mat3) {
  rotationZYXFromMat3(out, mat3);

  return out;
}
