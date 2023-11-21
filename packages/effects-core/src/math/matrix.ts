import type { vec3, vec4 } from '@galacean/effects-specification';
import type { mat3, mat4 } from './types';

const d2r = Math.PI / 180;

// TODO 抽成class
export function mat3FromQuat (out: mat3, quat: vec4): mat3 {
  const [x, y, z, w] = quat;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const yx = y * x2;
  const yy = y * y2;
  const zx = z * x2;
  const zy = z * y2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  out[0] = 1 - yy - zz;
  out[3] = yx - wz;
  out[6] = zx + wy;
  out[1] = yx + wz;
  out[4] = 1 - xx - zz;
  out[7] = zy - wx;
  out[2] = zx - wy;
  out[5] = zy + wx;
  out[8] = 1 - xx - yy;

  return out;
}

export function mat4create (): mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) as unknown as mat4;
  // return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4ToIdentityMatrix (m: mat4) {
  m[0] = 1.0;
  m[1] = 0.0;
  m[2] = 0.0;
  m[3] = 0.0;
  m[4] = 0.0;
  m[5] = 1.0;
  m[6] = 0.0;
  m[7] = 0.0;
  m[8] = 0.0;
  m[9] = 0.0;
  m[10] = 1.0;
  m[11] = 0.0;
  m[12] = 0.0;
  m[13] = 0.0;
  m[14] = 0.0;
  m[15] = 1.0;
}

export function isIdentityMatrix (m: mat4 | number[]): boolean {
  return m[0] === 1.0 &&
    m[1] === 0.0 &&
    m[2] === 0.0 &&
    m[3] === 0.0 &&
    m[4] === 0.0 &&
    m[5] === 1.0 &&
    m[6] === 0.0 &&
    m[7] === 0.0 &&
    m[8] === 0.0 &&
    m[9] === 0.0 &&
    m[10] === 1.0 &&
    m[11] === 0.0 &&
    m[12] === 0.0 &&
    m[13] === 0.0 &&
    m[14] === 0.0 &&
    m[15] === 1.0;
}

/**
 * 根据位移、旋转、缩放和锚点计算模型矩阵，锚点影响旋转中心
 * @param out - 结果矩阵
 * @param q - 四元数表示的旋转量
 * @param v - 位移向量
 * @param s - 缩放向量
 * @param a - 锚点向量
 * @returns
 */
export function mat4fromRotationTranslationScale (out: mat4 | number[], q: vec4, v: vec3, s: vec3, a?: vec3) {
  const l = a ? -a[0] : 0;
  const m = a ? -a[1] : 0;
  const n = a ? -a[2] : 0;
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = s[0];
  const sy = s[1];
  const sz = s[2];

  const r0 = (1 - (yy + zz)) * sx;
  const r1 = (xy + wz) * sx;
  const r2 = (xz - wy) * sx;
  const r4 = (xy - wz) * sy;
  const r5 = (1 - (xx + zz)) * sy;
  const r6 = (yz + wx) * sy;
  const r8 = (xz + wy) * sz;
  const r9 = (yz - wx) * sz;
  const r10 = (1 - (xx + yy)) * sz;

  out[0] = r0;
  out[1] = r1;
  out[2] = r2;
  out[3] = 0;
  out[4] = r4;
  out[5] = r5;
  out[6] = r6;
  out[7] = 0;
  out[8] = r8;
  out[9] = r9;
  out[10] = r10;
  out[11] = 0;
  out[12] = l * r0 + m * r4 + n * r8 - l + v[0];
  out[13] = l * r1 + m * r5 + n * r9 - m + v[1];
  out[14] = l * r2 + m * r6 + n * r10 - n + v[2];
  out[15] = 1;

  return out;

}

export function mat4invert (out: mat4 | number[], a: mat4): mat4 {
  if (isIdentityMatrix(a)) {
    return mat4Clone(out, a);
  }
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];
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
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

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

export function mat4multiply (out: mat4 | number[], a: mat4, b: mat4): mat4 {
  if (isIdentityMatrix(a)) {
    mat4Clone(out, b);

    return out as mat4;
  } else if (isIdentityMatrix(b)) {
    mat4Clone(out, a);

    return out as mat4;
  }
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  // Cache only the current line of the second matrix
  let b0 = b[0];
  let b1 = b[1];
  let b2 = b[2];
  let b3 = b[3];

  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  return out as mat4;
}

/**
 * 计算透视投影相机的投影矩阵
 * @param out - 结果矩阵
 * @param fovy - 视锥体的垂直视野角度
 * @param aspect - 视锥体的长宽比
 * @param near - 视锥体的近平面
 * @param far - 视锥体的远平面
 * @param reverse - 视锥体长宽反转
 */
export function mat4perspective (out: number[] | mat4, fovy: number, aspect: number, near: number, far: number, reverse?: boolean) {
  const f = 1.0 / Math.tan((fovy * d2r) / 2);
  let nf;

  out[0] = reverse ? f : f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = reverse ? f * aspect : f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
}

const matrixRotation = new Float32Array(9);
const quatOut = [0, 0, 0, 1];
const temps = [] as unknown as vec3;

export function mat4Determinate (a: mat4) {
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

  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}

export function getMat4TR (mat4: mat4 | number[], translate: vec3, quat: vec4, scaling: vec3) {
  const m11 = mat4[0];
  const m12 = mat4[1];
  const m13 = mat4[2];
  const m21 = mat4[4];
  const m22 = mat4[5];
  const m23 = mat4[6];
  const m31 = mat4[8];
  const m32 = mat4[9];
  const m33 = mat4[10];

  translate[0] = mat4[12];
  translate[1] = mat4[13];
  translate[2] = mat4[14];

  if (quat) {
    // copy from gl-matrix
    const is1 = 1 / scaling[0];
    const is2 = 1 / scaling[1];
    const is3 = 1 / scaling[2];

    matrixRotation[0] = m11 * is1;
    matrixRotation[1] = m12 * is1;
    matrixRotation[2] = m13 * is1;

    matrixRotation[3] = m21 * is2;
    matrixRotation[4] = m22 * is2;
    matrixRotation[5] = m23 * is2;

    matrixRotation[6] = m31 * is3;
    matrixRotation[7] = m32 * is3;
    matrixRotation[8] = m33 * is3;

    const fTrace = matrixRotation[0] + matrixRotation[4] + matrixRotation[8];
    let fRoot;

    if (fTrace > 0.0) {
      // |w| > 1/2, may as well choose w > 1/2
      fRoot = Math.sqrt(fTrace + 1.0); // 2w
      quatOut[3] = 0.5 * fRoot;
      fRoot = 0.5 / fRoot; // 1/(4w)
      quatOut[0] = (matrixRotation[5] - matrixRotation[7]) * fRoot;
      quatOut[1] = (matrixRotation[6] - matrixRotation[2]) * fRoot;
      quatOut[2] = (matrixRotation[1] - matrixRotation[3]) * fRoot;
    } else {
      // |w| <= 1/2
      let i = 0;

      if (matrixRotation[4] > matrixRotation[0]) { i = 1; }
      if (matrixRotation[8] > matrixRotation[i * 3 + i]) { i = 2; }
      const j = (i + 1) % 3;
      const k = (i + 2) % 3;

      fRoot = Math.sqrt(matrixRotation[i * 3 + i] - matrixRotation[j * 3 + j] - matrixRotation[k * 3 + k] + 1.0);
      quatOut[i] = 0.5 * fRoot;
      fRoot = 0.5 / fRoot;
      quatOut[3] = (matrixRotation[j * 3 + k] - matrixRotation[k * 3 + j]) * fRoot;
      quatOut[j] = (matrixRotation[j * 3 + i] + matrixRotation[i * 3 + j]) * fRoot;
      quatOut[k] = (matrixRotation[k * 3 + i] + matrixRotation[i * 3 + k]) * fRoot;
    }

    quat[0] = quatOut[0];
    quat[1] = quatOut[1];
    quat[2] = quatOut[2];
    quat[3] = quatOut[3];

  }

}

export function getMat4TRS (mat4: mat4, translate: vec3, quat: vec4, scaling: vec3) {

  scaling[0] = Math.hypot(mat4[0], mat4[1], mat4[2]);
  scaling[1] = Math.hypot(mat4[4], mat4[5], mat4[6]);
  scaling[2] = Math.hypot(mat4[8], mat4[9], mat4[10]);
  const det = mat4Determinate(mat4);

  if (det < 0) {
    scaling[0] = -scaling[0];
  }

  return getMat4TR(mat4, translate, quat, scaling);
}

export function mat4Clone (out: mat4 | number[], from: mat4): mat4 {
  for (let i = 0; i < 16; i++) {
    out[i] = from[i];
  }

  return out as mat4;
}
