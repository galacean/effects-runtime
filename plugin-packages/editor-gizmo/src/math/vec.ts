import type { spec } from '@galacean/effects';

type mat2 = spec.mat2;
type mat3 = spec.mat3;
type mat4 = spec.mat4;
type vec2 = spec.vec2;
type vec3 = spec.vec3;
type vec4 = spec.vec4;

export type vec = number[];

export {
  vec2, vec4, vec3, mat2, mat3, mat4,
};

const d2r = Math.PI / 180;
const r2d = 180 / Math.PI;
const cos = Math.cos;
const sin = Math.sin;

export function vecAdd<T extends vec | vec3 | vec4 | vec2> (out: T | number[], a: T, b: T): T {
  for (let i = 0, len = a.length; i < len; i++) {
    out[i] = a[i] + b[i];
  }

  return out as T;
}

export function vecSub<T extends vec | vec3 | vec4 | vec2> (out: T | number[], a: T, b: T): T {
  for (let i = 0, len = a.length; i < len; i++) {
    out[i] = a[i] - b[i];
  }

  return out as T;
}

export function vecAddCombine<T extends vec | vec3 | vec4 | vec2> (out: T | number[], a: T, b: T): T {
  if (a && b) {
    for (let i = 0, len = a.length; i < len; i++) {
      out[i] = a[i] + b[i];
    }

    return out as T;
  }

  return a || b;
}

export function vecMulCombine<T extends vec | vec3 | vec4 | vec2> (out: T | number[], a: T, b: T): T {
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

export function mat3NormalFromMat4 (out: mat3 | number[], a: mat4): mat3 {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  // Calculate the determinant
  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    for (let i = 0; i < 9; i++) {
      out[i] = NaN;
    }

    return out as mat3;
  }
  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

  return out as mat3;
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

export const NumberEpsilon = Number.EPSILON || Math.pow(2, -32);

export function vecNormalize<T extends vec | vec2 | vec3 | vec4> (a: T): T {
  let sum = 0;

  for (let i = 0, len = a.length; i < len; i++) {
    sum += a[i] * a[i];
  }
  sum = Math.sqrt(sum);

  return sum === 0 ? a.slice() as T : a.map(b => b / sum) as T;
}

export function vecMulScalar<T extends vec | vec3 | vec4 | vec2> (out: T | number[], vec: T, a: number): T {
  for (let i = 0, len = vec.length; i < len; i++) {
    out[i] = vec[i] * a;
  }

  return out as T;
}

export function vecDot (out: vec, a: vec, b?: number | vec): number | vec {
  if (isNaN(<number>b)) {
    let sum = 0;

    for (let i = 0, len = a.length; i < len; i++) {
      sum += out[i] * a[i];
    }

    return sum;
  }
  for (let i = 0, len = a.length; i < len; i++) {
    out[i] = a[i] * (b as number);
  }

  return (out);
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

export function vec4MulMat4 (out: vec4 | number[], cartesian: vec4, mat4: mat4): vec4 {
  const vX = cartesian[0];
  const vY = cartesian[1];
  const vZ = cartesian[2];
  const vW = cartesian[3];

  const x = mat4[0] * vX + mat4[4] * vY + mat4[8] * vZ + mat4[12] * vW;
  const y = mat4[1] * vX + mat4[5] * vY + mat4[9] * vZ + mat4[13] * vW;
  const z = mat4[2] * vX + mat4[6] * vY + mat4[10] * vZ + mat4[14] * vW;
  const w = mat4[3] * vX + mat4[7] * vY + mat4[11] * vZ + mat4[15] * vW;

  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;

  return out as vec4;
}

export function vec3TranslateByMat4 (out: vec3 | number[], vec3: vec3, matrix4: mat4): vec3 {
  out[0] = vec3[0] + matrix4[12];
  out[1] = vec3[1] + matrix4[13];
  out[2] = vec3[2] + matrix4[14];

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

export function vec3MulMat3 (out: vec3 | number[], a: vec3, m: mat3): vec3 {
  const x = a[0], y = a[1], z = a[2];

  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];

  return out as vec3;
}

export function vec3MulMat3ByPoint (out: vec3 | number[], a: vec3, m: mat3, c: vec3): vec3 {
  const x = a[0], y = a[1], z = a[2];
  const deltaX = a[0] - c[0], deltaY = a[1] - c[1], deltaZ = a[2] - c[2];
  const deltaOut = vec3MulMat3([], [deltaX, deltaY, deltaZ], m);

  out[0] = deltaOut[0] + c[0];
  out[1] = deltaOut[1] + c[1];
  out[2] = deltaOut[2] + c[2];

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

export function mat3FromRotationZYX (ret: mat3 | number[], x: number, y: number, z: number): mat3 {
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

export function invertMat4 (out: mat4 | number[], a: mat4): mat4 {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  // Calculate the determinant
  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    for (let i = 0; i < 16; i++) {
      out[i] = NaN;
    }

    return out as mat4;
  }
  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out as mat4;
}

export function isZeroVec (vec: vec): boolean {
  for (let i = 0, len = vec.length; i < len; i++) {
    if (Math.abs(vec[i]) > NumberEpsilon) {
      return false;
    }
  }

  return true;
}

const isArray = Array.isArray;

export function ensureVec3 (num?: any): vec3 {
  return isArray(num) ? [num[0], num[1], num[2]] : [0, 0, 0];
}

export function rotateVec2 (out: vec2 | number[], vec2: vec2, angleInRad: number): vec2 {
  const c = cos(angleInRad);
  const s = sin(angleInRad);
  const x = vec2[0];
  const y = vec2[1];

  out[0] = c * x + s * y;
  out[1] = -s * x + c * y;

  return out as vec2;
}

function rotationZYXFromMat3 (out: vec3 | number[], mat3: mat3): vec3 {
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

  return out as vec3;
}

export function rotationFromMat3 (out: vec3 | number[], mat3: mat3) {
  rotationZYXFromMat3(out, mat3);

  return out as vec3;
}

export function mat3MulMat3 (out: mat3 | number[], a: mat3, b: mat3): mat3 {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2];
  const a10 = a[3],
    a11 = a[4],
    a12 = a[5];
  const a20 = a[6],
    a21 = a[7],
    a22 = a[8];
  const b00 = b[0],
    b01 = b[1],
    b02 = b[2];
  const b10 = b[3],
    b11 = b[4],
    b12 = b[5];
  const b20 = b[6],
    b21 = b[7],
    b22 = b[8];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;

  return out as mat3;
}

export function mat4MulMat4 (a: mat4, b: mat4): mat4 {
  const out = [];
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];

  const b00 = b[0],
    b01 = b[1],
    b02 = b[2],
    b03 = b[3];
  const b10 = b[4],
    b11 = b[5],
    b12 = b[6],
    b13 = b[7];
  const b20 = b[8],
    b21 = b[9],
    b22 = b[10],
    b23 = b[11];
  const b30 = b[12],
    b31 = b[13],
    b32 = b[14],
    b33 = b[15];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
  out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

  out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
  out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
  out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
  out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

  out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
  out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
  out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
  out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

  out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
  out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
  out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
  out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

  return out as mat4;
}

export function clamp (v: number, min: number, max: number): number {
  return v > max ? max : (v < min ? min : v);
}

export function vec3ToVec2 (a: vec3): vec2 {
  return [a[0], a[1]];
}

export function distanceOfPointAndLine (point: vec2, line: [vec2, vec2]): { distance: number, isInLine: boolean } {
  //三角形三个边长
  const AC: vec2 = [0, 0];
  const BC: vec2 = [0, 0];
  const AB: vec2 = [0, 0];

  vecSub(AC, point, line[0]);
  vecSub(BC, point, line[1]);
  vecSub(AB, line[1], line[0]);
  const lengthAC = Math.hypot(...AC);
  const lengthBC = Math.hypot(...BC);
  const lengthAB = Math.hypot(...AB);

  //利用海伦公式计算三角形面积
  //周长的一半
  const P = (lengthAC + lengthBC + lengthAB) / 2;
  const allArea = Math.abs(Math.sqrt(P * (P - lengthAC) * (P - lengthBC) * (P - lengthAB)));
  //普通公式计算三角形面积反推点到线的垂直距离
  const distance = (2 * allArea) / lengthAB;
  const l1 = Math.sqrt(Math.pow(lengthAC, 2) - Math.pow(distance, 2));
  const l2 = Math.sqrt(Math.pow(lengthBC, 2) - Math.pow(distance, 2));
  let isInLine = false;

  if (l1 <= lengthAB && l2 <= lengthAB) {
    isInLine = true;
  }

  return {
    distance,
    isInLine,
  };
}

export function projectionOfPointAndLine (point: vec2, line: [vec3, vec3]): vec3 {
  const AC: vec2 = [0, 0];
  const BC: vec2 = [0, 0];
  const AB: vec2 = [0, 0];

  vecSub(AC, point, vec3ToVec2(line[0]));
  vecSub(BC, point, vec3ToVec2(line[1]));
  vecSub(AB, vec3ToVec2(line[1]), vec3ToVec2(line[0]));
  const lengthAC = Math.hypot(...AC);
  const lengthBC = Math.hypot(...BC);
  const lengthAB = Math.hypot(...AB);

  //利用海伦公式计算三角形面积
  //周长的一半
  const P = (lengthAC + lengthBC + lengthAB) / 2;
  const allArea = Math.abs(Math.sqrt(P * (P - lengthAC) * (P - lengthBC) * (P - lengthAB)));
  //普通公式计算三角形面积反推点到线的垂直距离
  const distance = (2 * allArea) / lengthAB;
  const l1 = Math.sqrt(Math.pow(lengthAC, 2) - Math.pow(distance, 2));
  const l2 = Math.sqrt(Math.pow(lengthBC, 2) - Math.pow(distance, 2));

  const worldAB: vec3 = [0, 0, 0];

  vecSub(worldAB, line[1], line[0]);
  const worldAP: vec3 = [0, 0, 0];

  vecMulScalar(worldAP, worldAB, l1 / (l1 + l2));
  const worldP: vec3 = [0, 0, 0];

  vecAdd(worldP, line[0], worldAP);

  return worldP;
}

export function computeOrthographicOffCenter (
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
) {
  let a = 1.0 / (right - left);
  let b = 1.0 / (top - bottom);
  let c = 1.0 / (far - near);

  const tx = -(right + left) * a;
  const ty = -(top + bottom) * b;
  const tz = -(far + near) * c;

  a *= 2.0;
  b *= 2.0;
  c *= -2.0;

  const result: mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  result[0] = a;
  result[1] = 0.0;
  result[2] = 0.0;
  result[3] = 0.0;
  result[4] = 0.0;
  result[5] = b;
  result[6] = 0.0;
  result[7] = 0.0;
  result[8] = 0.0;
  result[9] = 0.0;
  result[10] = c;
  result[11] = 0.0;
  result[12] = tx;
  result[13] = ty;
  result[14] = tz;
  result[15] = 1.0;

  return result;
}

export function computePerspectiveFieldOfView (
  fov: number,
  aspectRatio: number,
  near: number,
  far: number,
  reverse: boolean
) {
  const result = [];
  const invTanFov = 1.0 / Math.tan(fov * 0.5);

  const column0Row0 = reverse ? invTanFov : invTanFov / aspectRatio;
  const column1Row1 = reverse ? invTanFov * aspectRatio : invTanFov;
  const column2Row2 = (far + near) / (near - far);
  const column3Row2 = (2.0 * far * near) / (near - far);

  result[0] = column0Row0;
  result[1] = 0.0;
  result[2] = 0.0;
  result[3] = 0.0;
  result[4] = 0.0;
  result[5] = column1Row1;
  result[6] = 0.0;
  result[7] = 0.0;
  result[8] = 0.0;
  result[9] = 0.0;
  result[10] = column2Row2;
  result[11] = -1.0;
  result[12] = 0.0;
  result[13] = 0.0;
  result[14] = column3Row2;
  result[15] = 0.0;

  return result;

}
