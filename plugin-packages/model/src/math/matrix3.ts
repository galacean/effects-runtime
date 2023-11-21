import { Vector3 } from './vector3';
import type { Quaternion } from './quaternion';
import type { Mat3DataType } from './type';

class Matrix3 {
  private _data: Float32Array;

  constructor (
    column0Row0?: number,
    column1Row0?: number,
    column2Row0?: number,
    column0Row1?: number,
    column1Row1?: number,
    column2Row1?: number,
    column0Row2?: number,
    column1Row2?: number,
    column2Row2?: number) {
    this._data = new Float32Array(9);
    this._data[0] = (column0Row0 ?? 0.0);
    this._data[1] = (column0Row1 ?? 0.0);
    this._data[2] = (column0Row2 ?? 0.0);
    this._data[3] = (column1Row0 ?? 0.0);
    this._data[4] = (column1Row1 ?? 0.0);
    this._data[5] = (column1Row2 ?? 0.0);
    this._data[6] = (column2Row0 ?? 0.0);
    this._data[7] = (column2Row1 ?? 0.0);
    this._data[8] = (column2Row2 ?? 0.0);
  }

  getData () {
    return this._data;
  }

  // Matrix3.packedLength = 9;

  static pack (value: Matrix3, array: Mat3DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    array[startingIndex++] = value._data[0];
    array[startingIndex++] = value._data[1];
    array[startingIndex++] = value._data[2];
    array[startingIndex++] = value._data[3];
    array[startingIndex++] = value._data[4];
    array[startingIndex++] = value._data[5];
    array[startingIndex++] = value._data[6];
    array[startingIndex++] = value._data[7];
    array[startingIndex++] = value._data[8];

    return array;
  }

  static unpack (array: Mat3DataType, startingIndex: number, result: Matrix3) {
    result._data[0] = array[startingIndex++];
    result._data[1] = array[startingIndex++];
    result._data[2] = array[startingIndex++];
    result._data[3] = array[startingIndex++];
    result._data[4] = array[startingIndex++];
    result._data[5] = array[startingIndex++];
    result._data[6] = array[startingIndex++];
    result._data[7] = array[startingIndex++];
    result._data[8] = array[startingIndex++];

    return result;
  }

  static packArray (array: Matrix3[], result: Mat3DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Matrix3.pack(array[i], result, i * 9);
    }

    return result;
  }

  static unpackArray (array: Mat3DataType, result: Matrix3[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 9) {
      const index = i / 9;

      result[index] = Matrix3.unpack(array, i, result[index]);
    }

    return result;
  }

  static clone (matrix: Matrix3) {
    const result = new Matrix3();

    result._data[0] = matrix._data[0];
    result._data[1] = matrix._data[1];
    result._data[2] = matrix._data[2];
    result._data[3] = matrix._data[3];
    result._data[4] = matrix._data[4];
    result._data[5] = matrix._data[5];
    result._data[6] = matrix._data[6];
    result._data[7] = matrix._data[7];
    result._data[8] = matrix._data[8];

    return result;
  }

  static copyTo (matrix: Matrix3, result: Matrix3) {
    result._data[0] = matrix._data[0];
    result._data[1] = matrix._data[1];
    result._data[2] = matrix._data[2];
    result._data[3] = matrix._data[3];
    result._data[4] = matrix._data[4];
    result._data[5] = matrix._data[5];
    result._data[6] = matrix._data[6];
    result._data[7] = matrix._data[7];
    result._data[8] = matrix._data[8];

    return result;
  }

  static fromArray (array: Mat3DataType) {
    return Matrix3.unpack(array, 0, new Matrix3());
  }

  static fromColumnMajorArray (values: Mat3DataType, result: Matrix3) {
    return Matrix3.unpack(values, 0, result);
  }

  static fromRowMajorArray (values: Mat3DataType, result: Matrix3) {
    result._data[0] = values[0];
    result._data[1] = values[3];
    result._data[2] = values[6];
    result._data[3] = values[1];
    result._data[4] = values[4];
    result._data[5] = values[7];
    result._data[6] = values[2];
    result._data[7] = values[5];
    result._data[8] = values[8];

    return result;
  }

  static fromQuaternion (quaternion: Quaternion, result: Matrix3) {
    const x2 = quaternion.x * quaternion.x;
    const xy = quaternion.x * quaternion.y;
    const xz = quaternion.x * quaternion.z;
    const xw = quaternion.x * quaternion.w;
    const y2 = quaternion.y * quaternion.y;
    const yz = quaternion.y * quaternion.z;
    const yw = quaternion.y * quaternion.w;
    const z2 = quaternion.z * quaternion.z;
    const zw = quaternion.z * quaternion.w;
    const w2 = quaternion.w * quaternion.w;

    const m00 = x2 - y2 - z2 + w2;
    const m01 = 2.0 * (xy - zw);
    const m02 = 2.0 * (xz + yw);

    const m10 = 2.0 * (xy + zw);
    const m11 = -x2 + y2 - z2 + w2;
    const m12 = 2.0 * (yz - xw);

    const m20 = 2.0 * (xz - yw);
    const m21 = 2.0 * (yz + xw);
    const m22 = -x2 - y2 + z2 + w2;

    result._data[0] = m00;
    result._data[1] = m10;
    result._data[2] = m20;
    result._data[3] = m01;
    result._data[4] = m11;
    result._data[5] = m21;
    result._data[6] = m02;
    result._data[7] = m12;
    result._data[8] = m22;

    return result;
  }

  static fromHeadingPitchRoll (headingPitchRoll: { heading: number, pitch: number, roll: number }, result: Matrix3) {
    const cosTheta = Math.cos(-headingPitchRoll.pitch);
    const cosPsi = Math.cos(-headingPitchRoll.heading);
    const cosPhi = Math.cos(headingPitchRoll.roll);
    const sinTheta = Math.sin(-headingPitchRoll.pitch);
    const sinPsi = Math.sin(-headingPitchRoll.heading);
    const sinPhi = Math.sin(headingPitchRoll.roll);

    const m00 = cosTheta * cosPsi;
    const m01 = -cosPhi * sinPsi + sinPhi * sinTheta * cosPsi;
    const m02 = sinPhi * sinPsi + cosPhi * sinTheta * cosPsi;

    const m10 = cosTheta * sinPsi;
    const m11 = cosPhi * cosPsi + sinPhi * sinTheta * sinPsi;
    const m12 = -sinPhi * cosPsi + cosPhi * sinTheta * sinPsi;

    const m20 = -sinTheta;
    const m21 = sinPhi * cosTheta;
    const m22 = cosPhi * cosTheta;

    result._data[0] = m00;
    result._data[1] = m10;
    result._data[2] = m20;
    result._data[3] = m01;
    result._data[4] = m11;
    result._data[5] = m21;
    result._data[6] = m02;
    result._data[7] = m12;
    result._data[8] = m22;

    return result;
  }

  static fromScale (scale: Vector3, result: Matrix3) {
    result._data[0] = scale.x;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = scale.y;
    result._data[5] = 0.0;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = scale.z;

    return result;
  }

  static fromUniformScale (scale: number, result: Matrix3) {
    result._data[0] = scale;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = scale;
    result._data[5] = 0.0;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = scale;

    return result;
  }

  static fromCrossProduct (vector: Vector3, result: Matrix3) {
    result._data[0] = 0.0;
    result._data[1] = vector.z;
    result._data[2] = -vector.y;
    result._data[3] = -vector.z;
    result._data[4] = 0.0;
    result._data[5] = vector.x;
    result._data[6] = vector.y;
    result._data[7] = -vector.x;
    result._data[8] = 0.0;

    return result;
  }

  static fromRotationX (angle: number, result: Matrix3) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    result._data[0] = 1.0;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = cosAngle;
    result._data[5] = sinAngle;
    result._data[6] = 0.0;
    result._data[7] = -sinAngle;
    result._data[8] = cosAngle;

    return result;
  }

  static fromRotationY (angle: number, result: Matrix3) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    result._data[0] = cosAngle;
    result._data[1] = 0.0;
    result._data[2] = -sinAngle;
    result._data[3] = 0.0;
    result._data[4] = 1.0;
    result._data[5] = 0.0;
    result._data[6] = sinAngle;
    result._data[7] = 0.0;
    result._data[8] = cosAngle;

    return result;
  }

  static fromRotationZ (angle: number, result: Matrix3) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    result._data[0] = cosAngle;
    result._data[1] = sinAngle;
    result._data[2] = 0.0;
    result._data[3] = -sinAngle;
    result._data[4] = cosAngle;
    result._data[5] = 0.0;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 1.0;

    return result;
  }

  static toArray (matrix: Matrix3, result: Mat3DataType) {
    result[0] = matrix._data[0];
    result[1] = matrix._data[1];
    result[2] = matrix._data[2];
    result[3] = matrix._data[3];
    result[4] = matrix._data[4];
    result[5] = matrix._data[5];
    result[6] = matrix._data[6];
    result[7] = matrix._data[7];
    result[8] = matrix._data[8];

    return result;
  }

  static getElement (matrix: Matrix3, column: number, row: number) {
    return matrix._data[column * 3 + row];
  }

  static getColumn (matrix: Matrix3, index: number, result: Vector3) {
    const startIndex = index * 3;
    const x = matrix._data[startIndex];
    const y = matrix._data[startIndex + 1];
    const z = matrix._data[startIndex + 2];

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static setColumn (matrix: Matrix3, index: number, cartesian: Vector3, result: Matrix3) {
    result = Matrix3.copyTo(matrix, result);

    const startIndex = index * 3;

    result._data[startIndex] = cartesian.x;
    result._data[startIndex + 1] = cartesian.y;
    result._data[startIndex + 2] = cartesian.z;

    return result;
  }

  static getRow (matrix: Matrix3, index: number, result: Vector3) {
    const x = matrix._data[index];
    const y = matrix._data[index + 3];
    const z = matrix._data[index + 6];

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static setRow (matrix: Matrix3, index: number, cartesian: Vector3, result: Matrix3) {
    result = Matrix3.copyTo(matrix, result);
    result._data[index] = cartesian.x;
    result._data[index + 3] = cartesian.y;
    result._data[index + 6] = cartesian.z;

    return result;
  }

  static scale (matrix: Matrix3, scale: Vector3, result: Matrix3) {
    const existingScale = Matrix3.getScale(matrix, scaleScratch1);
    const scaleRatioX = scale.x / existingScale.x;
    const scaleRatioY = scale.y / existingScale.y;
    const scaleRatioZ = scale.z / existingScale.z;

    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioX;
    result._data[3] = matrix._data[3] * scaleRatioY;
    result._data[4] = matrix._data[4] * scaleRatioY;
    result._data[5] = matrix._data[5] * scaleRatioY;
    result._data[6] = matrix._data[6] * scaleRatioZ;
    result._data[7] = matrix._data[7] * scaleRatioZ;
    result._data[8] = matrix._data[8] * scaleRatioZ;

    return result;
  }

  static setUniformScale (matrix: Matrix3, scale: number, result: Matrix3) {
    const existingScale = Matrix3.getScale(matrix, scaleScratch2);
    const scaleRatioX = scale / existingScale.x;
    const scaleRatioY = scale / existingScale.y;
    const scaleRatioZ = scale / existingScale.z;

    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioX;
    result._data[3] = matrix._data[3] * scaleRatioY;
    result._data[4] = matrix._data[4] * scaleRatioY;
    result._data[5] = matrix._data[5] * scaleRatioY;
    result._data[6] = matrix._data[6] * scaleRatioZ;
    result._data[7] = matrix._data[7] * scaleRatioZ;
    result._data[8] = matrix._data[8] * scaleRatioZ;

    return result;
  }

  static getScale (matrix: Matrix3, result: Vector3) {
    scratchColumn.set(matrix._data[0], matrix._data[1], matrix._data[2]);
    result.x = Vector3.magnitude(scratchColumn);

    scratchColumn.set(matrix._data[3], matrix._data[4], matrix._data[5]);
    result.y = Vector3.magnitude(scratchColumn);

    scratchColumn.set(matrix._data[6], matrix._data[7], matrix._data[8]);
    result.z = Vector3.magnitude(scratchColumn);

    return result;
  }

  static getMaximumScale (matrix: Matrix3) {
    Matrix3.getScale(matrix, scaleScratch3);

    return Vector3.maximumComponent(scaleScratch3);
  }

  static setRotation (matrix: Matrix3, rotation: Matrix3, result: Matrix3) {
    const scale = Matrix3.getScale(matrix, scaleScratch4);

    result._data[0] = rotation._data[0] * scale.x;
    result._data[1] = rotation._data[1] * scale.x;
    result._data[2] = rotation._data[2] * scale.x;
    result._data[3] = rotation._data[3] * scale.y;
    result._data[4] = rotation._data[4] * scale.y;
    result._data[5] = rotation._data[5] * scale.y;
    result._data[6] = rotation._data[6] * scale.z;
    result._data[7] = rotation._data[7] * scale.z;
    result._data[8] = rotation._data[8] * scale.z;

    return result;
  }

  static getRotation (matrix: Matrix3, result: Matrix3) {
    const scale = Matrix3.getScale(matrix, scaleScratch5);

    result._data[0] = matrix._data[0] / scale.x;
    result._data[1] = matrix._data[1] / scale.x;
    result._data[2] = matrix._data[2] / scale.x;
    result._data[3] = matrix._data[3] / scale.y;
    result._data[4] = matrix._data[4] / scale.y;
    result._data[5] = matrix._data[5] / scale.y;
    result._data[6] = matrix._data[6] / scale.z;
    result._data[7] = matrix._data[7] / scale.z;
    result._data[8] = matrix._data[8] / scale.z;

    return result;
  }

  static multiply (left: Matrix3, right: Matrix3, result: Matrix3) {
    const column0Row0 =
      left._data[0] * right._data[0] + left._data[3] * right._data[1] + left._data[6] * right._data[2];
    const column0Row1 =
      left._data[1] * right._data[0] + left._data[4] * right._data[1] + left._data[7] * right._data[2];
    const column0Row2 =
      left._data[2] * right._data[0] + left._data[5] * right._data[1] + left._data[8] * right._data[2];

    const column1Row0 =
      left._data[0] * right._data[3] + left._data[3] * right._data[4] + left._data[6] * right._data[5];
    const column1Row1 =
      left._data[1] * right._data[3] + left._data[4] * right._data[4] + left._data[7] * right._data[5];
    const column1Row2 =
      left._data[2] * right._data[3] + left._data[5] * right._data[4] + left._data[8] * right._data[5];

    const column2Row0 =
      left._data[0] * right._data[6] + left._data[3] * right._data[7] + left._data[6] * right._data[8];
    const column2Row1 =
      left._data[1] * right._data[6] + left._data[4] * right._data[7] + left._data[7] * right._data[8];
    const column2Row2 =
      left._data[2] * right._data[6] + left._data[5] * right._data[7] + left._data[8] * right._data[8];

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column0Row2;
    result._data[3] = column1Row0;
    result._data[4] = column1Row1;
    result._data[5] = column1Row2;
    result._data[6] = column2Row0;
    result._data[7] = column2Row1;
    result._data[8] = column2Row2;

    return result;
  }

  static add (left: Matrix3, right: Matrix3, result: Matrix3) {
    result._data[0] = left._data[0] + right._data[0];
    result._data[1] = left._data[1] + right._data[1];
    result._data[2] = left._data[2] + right._data[2];
    result._data[3] = left._data[3] + right._data[3];
    result._data[4] = left._data[4] + right._data[4];
    result._data[5] = left._data[5] + right._data[5];
    result._data[6] = left._data[6] + right._data[6];
    result._data[7] = left._data[7] + right._data[7];
    result._data[8] = left._data[8] + right._data[8];

    return result;
  }

  static subtract (left: Matrix3, right: Matrix3, result: Matrix3) {
    result._data[0] = left._data[0] - right._data[0];
    result._data[1] = left._data[1] - right._data[1];
    result._data[2] = left._data[2] - right._data[2];
    result._data[3] = left._data[3] - right._data[3];
    result._data[4] = left._data[4] - right._data[4];
    result._data[5] = left._data[5] - right._data[5];
    result._data[6] = left._data[6] - right._data[6];
    result._data[7] = left._data[7] - right._data[7];
    result._data[8] = left._data[8] - right._data[8];

    return result;
  }

  static multiplyByVector (matrix: Matrix3, cartesian: Vector3, result: Vector3) {
    const vX = cartesian.x;
    const vY = cartesian.y;
    const vZ = cartesian.z;

    const x = matrix._data[0] * vX + matrix._data[3] * vY + matrix._data[6] * vZ;
    const y = matrix._data[1] * vX + matrix._data[4] * vY + matrix._data[7] * vZ;
    const z = matrix._data[2] * vX + matrix._data[5] * vY + matrix._data[8] * vZ;

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static multiplyByScalar (matrix: Matrix3, scalar: number, result: Matrix3) {
    result._data[0] = matrix._data[0] * scalar;
    result._data[1] = matrix._data[1] * scalar;
    result._data[2] = matrix._data[2] * scalar;
    result._data[3] = matrix._data[3] * scalar;
    result._data[4] = matrix._data[4] * scalar;
    result._data[5] = matrix._data[5] * scalar;
    result._data[6] = matrix._data[6] * scalar;
    result._data[7] = matrix._data[7] * scalar;
    result._data[8] = matrix._data[8] * scalar;

    return result;
  }

  static multiplyByScale (matrix: Matrix3, scale: Vector3, result: Matrix3) {
    result._data[0] = matrix._data[0] * scale.x;
    result._data[1] = matrix._data[1] * scale.x;
    result._data[2] = matrix._data[2] * scale.x;
    result._data[3] = matrix._data[3] * scale.y;
    result._data[4] = matrix._data[4] * scale.y;
    result._data[5] = matrix._data[5] * scale.y;
    result._data[6] = matrix._data[6] * scale.z;
    result._data[7] = matrix._data[7] * scale.z;
    result._data[8] = matrix._data[8] * scale.z;

    return result;
  }

  static multiplyByUniformScale (matrix: Matrix3, scale: number, result: Matrix3) {
    result._data[0] = matrix._data[0] * scale;
    result._data[1] = matrix._data[1] * scale;
    result._data[2] = matrix._data[2] * scale;
    result._data[3] = matrix._data[3] * scale;
    result._data[4] = matrix._data[4] * scale;
    result._data[5] = matrix._data[5] * scale;
    result._data[6] = matrix._data[6] * scale;
    result._data[7] = matrix._data[7] * scale;
    result._data[8] = matrix._data[8] * scale;

    return result;
  }

  static negate (matrix: Matrix3, result: Matrix3) {
    result._data[0] = -matrix._data[0];
    result._data[1] = -matrix._data[1];
    result._data[2] = -matrix._data[2];
    result._data[3] = -matrix._data[3];
    result._data[4] = -matrix._data[4];
    result._data[5] = -matrix._data[5];
    result._data[6] = -matrix._data[6];
    result._data[7] = -matrix._data[7];
    result._data[8] = -matrix._data[8];

    return result;
  }

  static transpose (matrix: Matrix3, result: Matrix3) {
    const column0Row0 = matrix._data[0];
    const column0Row1 = matrix._data[3];
    const column0Row2 = matrix._data[6];
    const column1Row0 = matrix._data[1];
    const column1Row1 = matrix._data[4];
    const column1Row2 = matrix._data[7];
    const column2Row0 = matrix._data[2];
    const column2Row1 = matrix._data[5];
    const column2Row2 = matrix._data[8];

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column0Row2;
    result._data[3] = column1Row0;
    result._data[4] = column1Row1;
    result._data[5] = column1Row2;
    result._data[6] = column2Row0;
    result._data[7] = column2Row1;
    result._data[8] = column2Row2;

    return result;
  }

  static abs (matrix: Matrix3, result: Matrix3) {
    if (result === undefined) {
      result = new Matrix3();
    }
    result._data[0] = Math.abs(matrix._data[0]);
    result._data[1] = Math.abs(matrix._data[1]);
    result._data[2] = Math.abs(matrix._data[2]);
    result._data[3] = Math.abs(matrix._data[3]);
    result._data[4] = Math.abs(matrix._data[4]);
    result._data[5] = Math.abs(matrix._data[5]);
    result._data[6] = Math.abs(matrix._data[6]);
    result._data[7] = Math.abs(matrix._data[7]);
    result._data[8] = Math.abs(matrix._data[8]);

    return result;
  }

  static determinant (matrix: Matrix3) {
    const m11 = matrix._data[0];
    const m21 = matrix._data[3];
    const m31 = matrix._data[6];
    const m12 = matrix._data[1];
    const m22 = matrix._data[4];
    const m32 = matrix._data[7];
    const m13 = matrix._data[2];
    const m23 = matrix._data[5];
    const m33 = matrix._data[8];

    return (
      m11 * (m22 * m33 - m23 * m32) +
      m12 * (m23 * m31 - m21 * m33) +
      m13 * (m21 * m32 - m22 * m31)
    );
  }

  static inverse (matrix: Matrix3, result: Matrix3) {
    const m11 = matrix._data[0];
    const m21 = matrix._data[1];
    const m31 = matrix._data[2];
    const m12 = matrix._data[3];
    const m22 = matrix._data[4];
    const m32 = matrix._data[5];
    const m13 = matrix._data[6];
    const m23 = matrix._data[7];
    const m33 = matrix._data[8];

    const determinant = Matrix3.determinant(matrix);

    // //>>includeStart('debug', pragmas.debug);
    // if (Math.abs(determinant) <= CesiumMath.EPSILON15) {
    //   throw new DeveloperError("matrix is not invertible");
    // }
    // //>>includeEnd('debug');

    result._data[0] = m22 * m33 - m23 * m32;
    result._data[1] = m23 * m31 - m21 * m33;
    result._data[2] = m21 * m32 - m22 * m31;
    result._data[3] = m13 * m32 - m12 * m33;
    result._data[4] = m11 * m33 - m13 * m31;
    result._data[5] = m12 * m31 - m11 * m32;
    result._data[6] = m12 * m23 - m13 * m22;
    result._data[7] = m13 * m21 - m11 * m23;
    result._data[8] = m11 * m22 - m12 * m21;

    const scale = 1.0 / determinant;

    return Matrix3.multiplyByScalar(result, scale, result);
  }

  static inverseTranspose (matrix: Matrix3, result: Matrix3) {
    return Matrix3.inverse(
      Matrix3.transpose(matrix, scratchTransposeMatrix),
      result
    );
  }

  static equals (left: Matrix3, right: Matrix3) {
    return (
      left === right ||
      (
        left._data[0] === right._data[0] &&
        left._data[1] === right._data[1] &&
        left._data[2] === right._data[2] &&
        left._data[3] === right._data[3] &&
        left._data[4] === right._data[4] &&
        left._data[5] === right._data[5] &&
        left._data[6] === right._data[6] &&
        left._data[7] === right._data[7] &&
        left._data[8] === right._data[8])
    );
  }

  static equalsEpsilon (left: Matrix3, right: Matrix3, epsilon: number) {
    epsilon = (epsilon ?? 0);

    return (
      left === right ||
      (
        Math.abs(left._data[0] - right._data[0]) <= epsilon &&
        Math.abs(left._data[1] - right._data[1]) <= epsilon &&
        Math.abs(left._data[2] - right._data[2]) <= epsilon &&
        Math.abs(left._data[3] - right._data[3]) <= epsilon &&
        Math.abs(left._data[4] - right._data[4]) <= epsilon &&
        Math.abs(left._data[5] - right._data[5]) <= epsilon &&
        Math.abs(left._data[6] - right._data[6]) <= epsilon &&
        Math.abs(left._data[7] - right._data[7]) <= epsilon &&
        Math.abs(left._data[8] - right._data[8]) <= epsilon)
    );
  }

  static getElementIndex (column: number, row: number) {
    return column * 3 + row;
  }

  getElement (column: number, row: number) {
    return Matrix3.getElement(this, column, row);
  }

  clone () {
    const result = Matrix3.clone(this);

    return result;
  }

  copyTo (result: Matrix3) {
    result = Matrix3.copyTo(this, result);

    return result;
  }

  copyFrom (source: Matrix3) {
    Matrix3.copyTo(source, this);

    return this;
  }

  scale (vector: Vector3) {
    const result = Matrix3.scale(this, vector, this);

    return result;
  }

  multiply (matrix: Matrix3): Matrix3 {
    const result = Matrix3.multiply(this, matrix, this);

    return result;
  }

  /**
     * 将矩阵数据按照列主序导出为number[]对象。
     * @returns
     */
  toArray (): number[] {
    const array = new Array<number>(9);
    const result = Matrix3.toArray(this, array) as number[];

    return result;
  }

  /**
   * 将矩阵按照列主序方式导出为Float32Array对象。
   * @returns
   */
  toFloat32Array (): Float32Array {
    const result = new Float32Array(9);

    Matrix3.pack(this, result, 0);

    return result;
  }

  /**
   * 矩阵与四维向量相乘。
   * @param vector
   * @returns
   */
  multiplyByVector3 (vector: Vector3) {
    const result = Matrix3.multiplyByVector(this, vector, new Vector3());

    return result;
  }

  /**
   * 返回矩阵中指定索引位置数据
   * @param index
   * @returns
   */
  at (index: number) {
    return this._data[index];
  }

  /**
   * 矩阵乘一个旋转矩阵，矩阵乘一个绕axis轴旋转angle角度的旋转矩阵
   * @param angle
   * @param axis
   * @returns
   */
  rotate (angle: number, axis: Vector3): Matrix3 | undefined {
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;

    let length = Math.sqrt(x * x + y * y + z * z);

    if (!length) {
      return undefined;
    }

    if (length !== 1) {
      length = 1 / length;
      x *= length;
      y *= length;
      z *= length;
    }

    const s = Math.sin(angle);
    const c = Math.cos(angle);

    const t = 1.0 - c;

    const a00 = this._data[0];
    const a01 = this._data[1];
    const a02 = this._data[2];
    const a03 = this._data[3];

    const a10 = this._data[4];
    const a11 = this._data[5];
    const a12 = this._data[6];
    const a13 = this._data[7];

    const a20 = this._data[8];
    const a21 = this._data[9];
    const a22 = this._data[10];
    const a23 = this._data[11];

    const b00 = x * x * t + c;
    const b01 = y * x * t + z * s;
    const b02 = z * x * t - y * s;

    const b10 = x * y * t - z * s;
    const b11 = y * y * t + c;
    const b12 = z * y * t + x * s;

    const b20 = x * z * t + y * s;
    const b21 = y * z * t - x * s;
    const b22 = z * z * t + c;

    this._data[0] = a00 * b00 + a10 * b01 + a20 * b02;
    this._data[1] = a01 * b00 + a11 * b01 + a21 * b02;
    this._data[2] = a02 * b00 + a12 * b01 + a22 * b02;
    this._data[3] = a03 * b00 + a13 * b01 + a23 * b02;

    this._data[4] = a00 * b10 + a10 * b11 + a20 * b12;
    this._data[5] = a01 * b10 + a11 * b11 + a21 * b12;
    this._data[6] = a02 * b10 + a12 * b11 + a22 * b12;
    this._data[7] = a03 * b10 + a13 * b11 + a23 * b12;

    this._data[8] = a00 * b20 + a10 * b21 + a20 * b22;
    this._data[9] = a01 * b20 + a11 * b21 + a21 * b22;
    this._data[10] = a02 * b20 + a12 * b21 + a22 * b22;
    this._data[11] = a03 * b20 + a13 * b21 + a23 * b22;

    return this;
  }

  /**
   * 计算矩阵的逆矩阵，会修改矩阵数据
   */
  inverse () {
    const result = Matrix3.inverse(this, this);

    return result;
  }

  /**
   * 计算矩阵的转置，结果保存在原矩阵中（会修改矩阵数据）
   * @returns
   */
  transpose () {
    const result = Matrix3.transpose(this, this);

    return result;
  }

  static IDENTITY = Object.freeze(
    new Matrix3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0)
  );

  static ZERO = Object.freeze(
    new Matrix3(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
  );

  static COLUMN0ROW0 = 0;
  static COLUMN0ROW1 = 1;
  static COLUMN0ROW2 = 2;
  static COLUMN1ROW0 = 3;
  static COLUMN1ROW1 = 4;
  static COLUMN1ROW2 = 5;
  static COLUMN2ROW0 = 6;
  static COLUMN2ROW1 = 7;
  static COLUMN2ROW2 = 8;
}

const scaleScratch1 = new Vector3();

const scaleScratch2 = new Vector3();

const scratchColumn = new Vector3();

const scaleScratch3 = new Vector3();

const scaleScratch4 = new Vector3();

const scaleScratch5 = new Vector3();

const scratchTransposeMatrix = new Matrix3();

export { Matrix3 };
