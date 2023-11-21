import type { Mat2DataType } from './type';
import { Vector2 } from './vector2';

/**
 * 2x2 矩阵内部按照列主序存储数据
 */
class Matrix2 {

  private _data: Float32Array;

  /**
   * 按照行主序传入矩阵数据
   * @param column0Row0 - 第0行0列
   * @param column1Row0 - 第0行1列
   * @param column0Row1
   * @param column1Row1
   */
  constructor (column0Row0?: number, column1Row0?: number, column0Row1?: number, column1Row1?: number) {
    this._data = new Float32Array(4);
    this._data[0] = (column0Row0 ?? 0.0);
    this._data[1] = (column0Row1 ?? 0.0);
    this._data[2] = (column1Row0 ?? 0.0);
    this._data[3] = (column1Row1 ?? 0.0);
  }

  getData () {
    return this._data;
  }

  // Matrix2.packedLength = 4;

  static pack (value: Matrix2, array: Mat2DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    array[startingIndex++] = value._data[0];
    array[startingIndex++] = value._data[1];
    array[startingIndex++] = value._data[2];
    array[startingIndex++] = value._data[3];

    return array;
  }

  static unpack (array: Mat2DataType, startingIndex: number, result: Matrix2) {
    result._data[0] = array[startingIndex++];
    result._data[1] = array[startingIndex++];
    result._data[2] = array[startingIndex++];
    result._data[3] = array[startingIndex++];

    return result;
  }

  static packArray (array: Matrix2[], result: Mat2DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Matrix2.pack(array[i], result, i * 4);
    }

    return result;
  }

  static unpackArray (array: Mat2DataType, result: Matrix2[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 4) {
      const index = i / 4;

      result[index] = Matrix2.unpack(array, i, result[index]);
    }

    return result;
  }

  static clone (matrix: Matrix2) {
    return new Matrix2(matrix._data[0], matrix._data[2], matrix._data[1], matrix._data[3]);
  }

  static fromArray (array: Mat2DataType) {
    return Matrix2.unpack(array, 0, new Matrix2());
  }

  static fromColumnMajorArray (values: Mat2DataType, result: Matrix2) {
    return Matrix2.unpack(values, 0, result);
  }

  static fromRowMajorArray (values: Mat2DataType, result: Matrix2) {
    if (result === undefined) {
      return new Matrix2(values[0], values[1], values[2], values[3]);
    }

    result._data[0] = values[0];
    result._data[1] = values[2];
    result._data[2] = values[1];
    result._data[3] = values[3];

    return result;
  }

  static fromScale (scale: Vector2, result: Matrix2) {
    result._data[0] = scale.x;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = scale.y;

    return result;
  }

  static fromUniformScale (scale: number, result: Matrix2) {
    result._data[0] = scale;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = scale;

    return result;
  }

  static fromRotation (angle: number, result: Matrix2) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    result._data[0] = cosAngle;
    result._data[1] = sinAngle;
    result._data[2] = -sinAngle;
    result._data[3] = cosAngle;

    return result;
  }

  static toArray (matrix: Matrix2, result: Mat2DataType) {
    result[0] = matrix._data[0];
    result[1] = matrix._data[1];
    result[2] = matrix._data[2];
    result[3] = matrix._data[3];

    return result;
  }

  static getElement (matrix: Matrix2, column: number, row: number) {
    return matrix._data[column * 2 + row];
  }

  static getColumn (matrix: Matrix2, index: number, result: Vector2) {
    const startIndex = index * 2;
    const x = matrix._data[startIndex];
    const y = matrix._data[startIndex + 1];

    result.x = x;
    result.y = y;

    return result;
  }

  static setColumn (matrix: Matrix2, index: number, cartesian: Vector2, result: Matrix2) {
    result = matrix.copyTo(result);
    const startIndex = index * 2;

    result._data[startIndex] = cartesian.x;
    result._data[startIndex + 1] = cartesian.y;

    return result;
  }

  static getRow (matrix: Matrix2, index: number, result?: Vector2) {
    if (result === undefined) {
      result = new Vector2();
    }
    const x = matrix._data[index];
    const y = matrix._data[index + 2];

    result.x = x;
    result.y = y;

    return result;
  }

  static setRow (matrix: Matrix2, index: number, cartesian: Vector2, result: Matrix2) {
    result = matrix.copyTo(result);
    result._data[index] = cartesian.x;
    result._data[index + 2] = cartesian.y;

    return result;
  }

  static scale (matrix: Matrix2, scale: Vector2, result?: Matrix2) {
    const existingScale = Matrix2.getScale(matrix, scaleScratch1);
    const scaleRatioX = scale.x / existingScale.x;
    const scaleRatioY = scale.y / existingScale.y;

    if (result === undefined) {
      result = new Matrix2();
    }
    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioY;
    result._data[3] = matrix._data[3] * scaleRatioY;

    return result;
  }

  static setUniformScale (matrix: Matrix2, scale: number, result?: Matrix2) {
    const existingScale = Matrix2.getScale(matrix, scaleScratch2);
    const scaleRatioX = scale / existingScale.x;
    const scaleRatioY = scale / existingScale.y;

    if (result === undefined) {
      result = new Matrix2();
    }
    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioY;
    result._data[3] = matrix._data[3] * scaleRatioY;

    return result;
  }

  static getScale (matrix: Matrix2, result: Vector2) {
    scratchColumn.set(matrix._data[0], matrix._data[1]);
    result.x = Vector2.magnitude(scratchColumn);

    scratchColumn.set(matrix._data[2], matrix._data[3]);
    result.y = Vector2.magnitude(scratchColumn);

    return result;
  }

  static getMaximumScale (matrix: Matrix2) {
    Matrix2.getScale(matrix, scaleScratch3);

    return Vector2.maximumComponent(scaleScratch3);
  }

  static setRotation (matrix: Matrix2, rotation: Matrix2, result: Matrix2) {
    const scale = Matrix2.getScale(matrix, scaleScratch4);

    result._data[0] = rotation._data[0] * scale.x;
    result._data[1] = rotation._data[1] * scale.x;
    result._data[2] = rotation._data[2] * scale.y;
    result._data[3] = rotation._data[3] * scale.y;

    return result;
  }

  static getRotation (matrix: Matrix2, result: Matrix2) {
    const scale = Matrix2.getScale(matrix, scaleScratch5);

    result._data[0] = matrix._data[0] / scale.x;
    result._data[1] = matrix._data[1] / scale.x;
    result._data[2] = matrix._data[2] / scale.y;
    result._data[3] = matrix._data[3] / scale.y;

    return result;
  }

  static multiply (left: Matrix2, right: Matrix2, result: Matrix2) {
    const column0Row0 = left._data[0] * right._data[0] + left._data[2] * right._data[1];
    const column1Row0 = left._data[0] * right._data[2] + left._data[2] * right._data[3];
    const column0Row1 = left._data[1] * right._data[0] + left._data[3] * right._data[1];
    const column1Row1 = left._data[1] * right._data[2] + left._data[3] * right._data[3];

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column1Row0;
    result._data[3] = column1Row1;

    return result;
  }

  static add (left: Matrix2, right: Matrix2, result: Matrix2) {
    result._data[0] = left._data[0] + right._data[0];
    result._data[1] = left._data[1] + right._data[1];
    result._data[2] = left._data[2] + right._data[2];
    result._data[3] = left._data[3] + right._data[3];

    return result;
  }

  static subtract (left: Matrix2, right: Matrix2, result: Matrix2) {
    result._data[0] = left._data[0] - right._data[0];
    result._data[1] = left._data[1] - right._data[1];
    result._data[2] = left._data[2] - right._data[2];
    result._data[3] = left._data[3] - right._data[3];

    return result;
  }

  static multiplyByVector (matrix: Matrix2, cartesian: Vector2, result: Vector2) {
    const x = matrix._data[0] * cartesian.x + matrix._data[2] * cartesian.y;
    const y = matrix._data[1] * cartesian.x + matrix._data[3] * cartesian.y;

    result.x = x;
    result.y = y;

    return result;
  }

  static multiplyByScalar (matrix: Matrix2, scalar: number, result: Matrix2) {
    result._data[0] = matrix._data[0] * scalar;
    result._data[1] = matrix._data[1] * scalar;
    result._data[2] = matrix._data[2] * scalar;
    result._data[3] = matrix._data[3] * scalar;

    return result;
  }

  static multiplyByScale (matrix: Matrix2, scale: Vector2, result: Matrix2) {
    result._data[0] = matrix._data[0] * scale.x;
    result._data[1] = matrix._data[1] * scale.x;
    result._data[2] = matrix._data[2] * scale.y;
    result._data[3] = matrix._data[3] * scale.y;

    return result;
  }

  static multiplyByUniformScale (matrix: Matrix2, scale: number, result: Matrix2) {
    result._data[0] = matrix._data[0] * scale;
    result._data[1] = matrix._data[1] * scale;
    result._data[2] = matrix._data[2] * scale;
    result._data[3] = matrix._data[3] * scale;

    return result;
  }

  static negate (matrix: Matrix2, result: Matrix2) {
    result._data[0] = -matrix._data[0];
    result._data[1] = -matrix._data[1];
    result._data[2] = -matrix._data[2];
    result._data[3] = -matrix._data[3];

    return result;
  }

  static transpose (matrix: Matrix2, result: Matrix2) {
    const column0Row0 = matrix._data[0];
    const column0Row1 = matrix._data[2];
    const column1Row0 = matrix._data[1];
    const column1Row1 = matrix._data[3];

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column1Row0;
    result._data[3] = column1Row1;

    return result;
  }

  static abs (matrix: Matrix2, result: Matrix2) {
    result._data[0] = Math.abs(matrix._data[0]);
    result._data[1] = Math.abs(matrix._data[1]);
    result._data[2] = Math.abs(matrix._data[2]);
    result._data[3] = Math.abs(matrix._data[3]);

    return result;
  }

  static equals (left: Matrix2, right: Matrix2) {
    return (
      left === right ||
      (left._data[0] === right._data[0] &&
        left._data[1] === right._data[1] &&
        left._data[2] === right._data[2] &&
        left._data[3] === right._data[3]));
  }

  static equalsArray (matrix: Matrix2, array: Mat2DataType, offset?: number) {
    offset = offset ?? 0;

    return (
      matrix._data[0] === array[offset] &&
      matrix._data[1] === array[offset + 1] &&
      matrix._data[2] === array[offset + 2] &&
      matrix._data[3] === array[offset + 3]
    );
  }

  static equalsEpsilon (left: Matrix2, right: Matrix2, epsilon: number) {
    epsilon = (epsilon ?? 0);

    return (
      left === right ||
      (
        Math.abs(left._data[0] - right._data[0]) <= epsilon &&
        Math.abs(left._data[1] - right._data[1]) <= epsilon &&
        Math.abs(left._data[2] - right._data[2]) <= epsilon &&
        Math.abs(left._data[3] - right._data[3]) <= epsilon)
    );
  }

  copyTo (result: Matrix2) {

    result._data[0] = this._data[0];
    result._data[1] = this._data[1];
    result._data[2] = this._data[2];
    result._data[3] = this._data[3];

    return result;

  }

  copyFrom (source: Matrix2) {

    this._data[0] = source._data[0];
    this._data[1] = source._data[1];
    this._data[2] = source._data[2];
    this._data[3] = source._data[3];

    return this;

  }

  static IDENTITY = Object.freeze(new Matrix2(1.0, 0.0, 0.0, 1.0));

  static ZERO = Object.freeze(new Matrix2(0.0, 0.0, 0.0, 0.0));
}

const scaleScratch1 = new Vector2();
const scaleScratch2 = new Vector2();
const scratchColumn = new Vector2();
const scaleScratch3 = new Vector2();
const scaleScratch4 = new Vector2();
const scaleScratch5 = new Vector2();

export { Matrix2 };
