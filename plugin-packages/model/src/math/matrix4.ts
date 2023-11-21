import { Vector3 } from './vector3';
import { Vector4 } from './vector4';
import { Matrix3 } from './matrix3';
import { Quaternion } from './quaternion';
import type { Mat4DataType } from './type';
import { MathUtils } from './utilities';

/**
 * 表示一个 4x4 矩阵
 */
class Matrix4 {
  private _data: Float32Array;

  constructor (
    column0Row0?: number,
    column1Row0?: number,
    column2Row0?: number,
    column3Row0?: number,
    column0Row1?: number,
    column1Row1?: number,
    column2Row1?: number,
    column3Row1?: number,
    column0Row2?: number,
    column1Row2?: number,
    column2Row2?: number,
    column3Row2?: number,
    column0Row3?: number,
    column1Row3?: number,
    column2Row3?: number,
    column3Row3?: number
  ) {
    this._data = new Float32Array(16);
    this._data[0] = (column0Row0 ?? 0.0);
    this._data[1] = (column0Row1 ?? 0.0);
    this._data[2] = (column0Row2 ?? 0.0);
    this._data[3] = (column0Row3 ?? 0.0);
    this._data[4] = (column1Row0 ?? 0.0);
    this._data[5] = (column1Row1 ?? 0.0);
    this._data[6] = (column1Row2 ?? 0.0);
    this._data[7] = (column1Row3 ?? 0.0);
    this._data[8] = (column2Row0 ?? 0.0);
    this._data[9] = (column2Row1 ?? 0.0);
    this._data[10] = (column2Row2 ?? 0.0);
    this._data[11] = (column2Row3 ?? 0.0);
    this._data[12] = (column3Row0 ?? 0.0);
    this._data[13] = (column3Row1 ?? 0.0);
    this._data[14] = (column3Row2 ?? 0.0);
    this._data[15] = (column3Row3 ?? 0.0);
  }

  /**
   * 获取矩阵内部存储数据的Float32Array对象。
   * @returns
   */
  getData () {
    return this._data;
  }
  setData (data: Float32Array) {
    this._data = data;
  }

  get data () {
    return this._data;
  }

  lookAt (position: Vector3, target: Vector3, up: Vector3) {
    return Matrix4.computeLookAt(position, target, up, this);
  }

  perspective (fovY: number, aspect: number, near: number, far: number, reverse: boolean) {
    return Matrix4.computePerspective(fovY, aspect, near, far, reverse, this);
  }

  orth2d (
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number
  ) {
    return Matrix4.computeOrthographic(left, right, bottom, top, near, far, this);
  }

  compose (translation: Vector3, rotation: Quaternion, scale: Vector3) {
    return Matrix4.compose(translation, rotation, scale, this);
  }

  decompose () {
    return Matrix4.decompose(this);
  }

  multiplyByPoint3 (result: Vector3) {

    return Matrix4.multiplyByPoint(this, result, result);
  }

  setZero () {
    const data = this._data;

    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }

  setIdentity () {
    const data = this._data;

    for (let i = 0; i < data.length; i++) {
      data[i] = i % 5 ? 0 : 1;
    }
  }

  /**
   * 打包矩阵数据，将矩阵内部数据从数组指定索引位置打包到数组中。
   * @param value
   * @param array
   * @param startingIndex
   * @returns
   */
  static pack (value: Matrix4, array: Mat4DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    if (array.length < startingIndex + 16) {
      throw '数组长度不够';
    }

    array[startingIndex++] = value._data[0];
    array[startingIndex++] = value._data[1];
    array[startingIndex++] = value._data[2];
    array[startingIndex++] = value._data[3];
    array[startingIndex++] = value._data[4];
    array[startingIndex++] = value._data[5];
    array[startingIndex++] = value._data[6];
    array[startingIndex++] = value._data[7];
    array[startingIndex++] = value._data[8];
    array[startingIndex++] = value._data[9];
    array[startingIndex++] = value._data[10];
    array[startingIndex++] = value._data[11];
    array[startingIndex++] = value._data[12];
    array[startingIndex++] = value._data[13];
    array[startingIndex++] = value._data[14];
    array[startingIndex] = value._data[15];

    return array;
  }

  /**
   * 解包矩阵数据，从数组指定索引位置开始解包矩阵数据。
   * @param array
   * @param startingIndex
   * @param result
   * @returns
   */
  static unpack (array: Mat4DataType, startingIndex: number, result: Matrix4) {
    startingIndex = (startingIndex ?? 0);

    result._data[0] = array[startingIndex++];
    result._data[1] = array[startingIndex++];
    result._data[2] = array[startingIndex++];
    result._data[3] = array[startingIndex++];
    result._data[4] = array[startingIndex++];
    result._data[5] = array[startingIndex++];
    result._data[6] = array[startingIndex++];
    result._data[7] = array[startingIndex++];
    result._data[8] = array[startingIndex++];
    result._data[9] = array[startingIndex++];
    result._data[10] = array[startingIndex++];
    result._data[11] = array[startingIndex++];
    result._data[12] = array[startingIndex++];
    result._data[13] = array[startingIndex++];
    result._data[14] = array[startingIndex++];
    result._data[15] = array[startingIndex];

    return result;
  }

  static packArray (array: Matrix4[], result: Mat4DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Matrix4.pack(array[i], result, i * 16);
    }

    return result;
  }

  static unpackArray (array: Mat4DataType, result: Matrix4[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 16) {
      const index = i / 16;

      result[index] = Matrix4.unpack(array, i, result[index]);
    }

    return result;
  }

  static clone (matrix: Matrix4 | Readonly<Matrix4>) {
    const result = new Matrix4();

    result._data[0] = matrix.getData()[0];
    result._data[1] = matrix.getData()[1];
    result._data[2] = matrix.getData()[2];
    result._data[3] = matrix.getData()[3];
    result._data[4] = matrix.getData()[4];
    result._data[5] = matrix.getData()[5];
    result._data[6] = matrix.getData()[6];
    result._data[7] = matrix.getData()[7];
    result._data[8] = matrix.getData()[8];
    result._data[9] = matrix.getData()[9];
    result._data[10] = matrix.getData()[10];
    result._data[11] = matrix.getData()[11];
    result._data[12] = matrix.getData()[12];
    result._data[13] = matrix.getData()[13];
    result._data[14] = matrix.getData()[14];
    result._data[15] = matrix.getData()[15];

    return result;
  }

  static copyTo (matrix: Matrix4, result: Matrix4) {
    result._data[0] = matrix.getData()[0];
    result._data[1] = matrix.getData()[1];
    result._data[2] = matrix.getData()[2];
    result._data[3] = matrix.getData()[3];
    result._data[4] = matrix.getData()[4];
    result._data[5] = matrix.getData()[5];
    result._data[6] = matrix.getData()[6];
    result._data[7] = matrix.getData()[7];
    result._data[8] = matrix.getData()[8];
    result._data[9] = matrix.getData()[9];
    result._data[10] = matrix.getData()[10];
    result._data[11] = matrix.getData()[11];
    result._data[12] = matrix.getData()[12];
    result._data[13] = matrix.getData()[13];
    result._data[14] = matrix.getData()[14];
    result._data[15] = matrix.getData()[15];

    return result;
  }

  static fromArray (array: Mat4DataType) {
    return Matrix4.unpack(array, 0, new Matrix4());
  }

  static fromColumnMajorArray (values: Mat4DataType, result: Matrix4) {
    return Matrix4.unpack(values, 0, result);
  }

  static fromRowMajorArray (values: Mat4DataType, result: Matrix4) {
    result._data[0] = values[0];
    result._data[1] = values[4];
    result._data[2] = values[8];
    result._data[3] = values[12];
    result._data[4] = values[1];
    result._data[5] = values[5];
    result._data[6] = values[9];
    result._data[7] = values[13];
    result._data[8] = values[2];
    result._data[9] = values[6];
    result._data[10] = values[10];
    result._data[11] = values[14];
    result._data[12] = values[3];
    result._data[13] = values[7];
    result._data[14] = values[11];
    result._data[15] = values[15];

    return result;
  }

  static fromRotationTranslation (rotation: Matrix3 | Readonly<Matrix3>, translation: Vector3, result: Matrix4) {
    result._data[0] = rotation.getData()[0];
    result._data[1] = rotation.getData()[1];
    result._data[2] = rotation.getData()[2];
    result._data[3] = 0.0;
    result._data[4] = rotation.getData()[3];
    result._data[5] = rotation.getData()[4];
    result._data[6] = rotation.getData()[5];
    result._data[7] = 0.0;
    result._data[8] = rotation.getData()[6];
    result._data[9] = rotation.getData()[7];
    result._data[10] = rotation.getData()[8];
    result._data[11] = 0.0;
    result._data[12] = translation.x;
    result._data[13] = translation.y;
    result._data[14] = translation.z;
    result._data[15] = 1.0;

    return result;
  }

  static fromTranslationQuaternionRotationScale (
    translation: Vector3,
    rotation: Quaternion,
    scale: Vector3,
    result: Matrix4
  ) {
    const scaleX = scale.x;
    const scaleY = scale.y;
    const scaleZ = scale.z;

    const x2 = rotation.x * rotation.x;
    const xy = rotation.x * rotation.y;
    const xz = rotation.x * rotation.z;
    const xw = rotation.x * rotation.w;
    const y2 = rotation.y * rotation.y;
    const yz = rotation.y * rotation.z;
    const yw = rotation.y * rotation.w;
    const z2 = rotation.z * rotation.z;
    const zw = rotation.z * rotation.w;
    const w2 = rotation.w * rotation.w;

    const m00 = x2 - y2 - z2 + w2;
    const m01 = 2.0 * (xy - zw);
    const m02 = 2.0 * (xz + yw);

    const m10 = 2.0 * (xy + zw);
    const m11 = -x2 + y2 - z2 + w2;
    const m12 = 2.0 * (yz - xw);

    const m20 = 2.0 * (xz - yw);
    const m21 = 2.0 * (yz + xw);
    const m22 = -x2 - y2 + z2 + w2;

    result._data[0] = m00 * scaleX;
    result._data[1] = m10 * scaleX;
    result._data[2] = m20 * scaleX;
    result._data[3] = 0.0;
    result._data[4] = m01 * scaleY;
    result._data[5] = m11 * scaleY;
    result._data[6] = m21 * scaleY;
    result._data[7] = 0.0;
    result._data[8] = m02 * scaleZ;
    result._data[9] = m12 * scaleZ;
    result._data[10] = m22 * scaleZ;
    result._data[11] = 0.0;
    result._data[12] = translation.x;
    result._data[13] = translation.y;
    result._data[14] = translation.z;
    result._data[15] = 1.0;

    return result;
  }

  static fromTranslationRotationScale (
    translationRotationScale: { translation: Vector3, rotation: Quaternion, scale: Vector3 },
    result: Matrix4
  ) {
    return Matrix4.fromTranslationQuaternionRotationScale(
      translationRotationScale.translation,
      translationRotationScale.rotation,
      translationRotationScale.scale,
      result
    );
  }

  static fromTranslation (translation: Vector3, result: Matrix4) {
    return Matrix4.fromRotationTranslation(Matrix3.IDENTITY, translation, result);
  }

  static fromScale (scale: Vector3, result: Matrix4) {
    result._data[0] = scale.x;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = scale.y;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 0.0;
    result._data[9] = 0.0;
    result._data[10] = scale.z;
    result._data[11] = 0.0;
    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = 0.0;
    result._data[15] = 1.0;

    return result;
  }

  static fromUniformScale (scale: number, result: Matrix4) {
    result._data[0] = scale;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = scale;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 0.0;
    result._data[9] = 0.0;
    result._data[10] = scale;
    result._data[11] = 0.0;
    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = 0.0;
    result._data[15] = 1.0;

    return result;
  }

  static fromRotation (rotation: Matrix3, result: Matrix4) {
    result._data[0] = rotation.getData()[0];
    result._data[1] = rotation.getData()[1];
    result._data[2] = rotation.getData()[2];
    result._data[3] = 0.0;

    result._data[4] = rotation.getData()[3];
    result._data[5] = rotation.getData()[4];
    result._data[6] = rotation.getData()[5];
    result._data[7] = 0.0;

    result._data[8] = rotation.getData()[6];
    result._data[9] = rotation.getData()[7];
    result._data[10] = rotation.getData()[8];
    result._data[11] = 0.0;

    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = 0.0;
    result._data[15] = 1.0;

    return result;
  }

  static fromCamera (camera: { position: Vector3, direction: Vector3, up: Vector3 }, result: Matrix4) {
    const position = camera.position;
    const direction = camera.direction;
    const up = camera.up;

    Vector3.normalize(direction, fromCameraF);
    Vector3.normalize(
      Vector3.cross(fromCameraF, up, fromCameraR),
      fromCameraR
    );
    Vector3.normalize(
      Vector3.cross(fromCameraR, fromCameraF, fromCameraU),
      fromCameraU
    );

    const sX = fromCameraR.x;
    const sY = fromCameraR.y;
    const sZ = fromCameraR.z;
    const fX = fromCameraF.x;
    const fY = fromCameraF.y;
    const fZ = fromCameraF.z;
    const uX = fromCameraU.x;
    const uY = fromCameraU.y;
    const uZ = fromCameraU.z;
    const positionX = position.x;
    const positionY = position.y;
    const positionZ = position.z;
    const t0 = sX * -positionX + sY * -positionY + sZ * -positionZ;
    const t1 = uX * -positionX + uY * -positionY + uZ * -positionZ;
    const t2 = fX * positionX + fY * positionY + fZ * positionZ;

    result._data[0] = sX;
    result._data[1] = uX;
    result._data[2] = -fX;
    result._data[3] = 0.0;
    result._data[4] = sY;
    result._data[5] = uY;
    result._data[6] = -fY;
    result._data[7] = 0.0;
    result._data[8] = sZ;
    result._data[9] = uZ;
    result._data[10] = -fZ;
    result._data[11] = 0.0;
    result._data[12] = t0;
    result._data[13] = t1;
    result._data[14] = t2;
    result._data[15] = 1.0;

    return result;
  }

  static computePerspectiveFieldOfView (
    fov: number,
    aspectRatio: number,
    near: number,
    far: number,
    reverse: boolean,
    result: Matrix4,
  ) {
    const invTanFov = 1.0 / Math.tan(fov * 0.5);

    const column0Row0 = reverse ? invTanFov : invTanFov / aspectRatio;
    const column1Row1 = reverse ? invTanFov * aspectRatio : invTanFov;
    const column2Row2 = (far + near) / (near - far);
    const column3Row2 = (2.0 * far * near) / (near - far);

    result._data[0] = column0Row0;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = column1Row1;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 0.0;
    result._data[9] = 0.0;
    result._data[10] = column2Row2;
    result._data[11] = -1.0;
    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = column3Row2;
    result._data[15] = 0.0;

    return result;
  }

  static computeOrthographicOffCenter (
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    result: Matrix4
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

    result._data[0] = a;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = b;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 0.0;
    result._data[9] = 0.0;
    result._data[10] = c;
    result._data[11] = 0.0;
    result._data[12] = tx;
    result._data[13] = ty;
    result._data[14] = tz;
    result._data[15] = 1.0;

    return result;
  }

  static computePerspectiveOffCenter (
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    result: Matrix4
  ) {
    const column0Row0 = (2.0 * near) / (right - left);
    const column1Row1 = (2.0 * near) / (top - bottom);
    const column2Row0 = (right + left) / (right - left);
    const column2Row1 = (top + bottom) / (top - bottom);
    const column2Row2 = -(far + near) / (far - near);
    const column2Row3 = -1.0;
    const column3Row2 = (-2.0 * far * near) / (far - near);

    result._data[0] = column0Row0;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = column1Row1;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = column2Row0;
    result._data[9] = column2Row1;
    result._data[10] = column2Row2;
    result._data[11] = column2Row3;
    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = column3Row2;
    result._data[15] = 0.0;

    return result;
  }

  static computeInfinitePerspectiveOffCenter (
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    result: Matrix4
  ) {
    const column0Row0 = (2.0 * near) / (right - left);
    const column1Row1 = (2.0 * near) / (top - bottom);
    const column2Row0 = (right + left) / (right - left);
    const column2Row1 = (top + bottom) / (top - bottom);
    const column2Row2 = -1.0;
    const column2Row3 = -1.0;
    const column3Row2 = -2.0 * near;

    result._data[0] = column0Row0;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = column1Row1;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = column2Row0;
    result._data[9] = column2Row1;
    result._data[10] = column2Row2;
    result._data[11] = column2Row3;
    result._data[12] = 0.0;
    result._data[13] = 0.0;
    result._data[14] = column3Row2;
    result._data[15] = 0.0;

    return result;
  }

  static computeViewportTransformation (
    viewport: { x: number, y: number, width: number, height: number },
    nearDepthRange: number,
    farDepthRange: number,
    result: Matrix4
  ) {
    const x = (viewport.x ?? 0.0);
    const y = (viewport.y ?? 0.0);
    const width = (viewport.width ?? 0.0);
    const height = (viewport.height ?? 0.0);

    nearDepthRange = (nearDepthRange ?? 0.0);
    farDepthRange = (farDepthRange ?? 1.0);

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const halfDepth = (farDepthRange - nearDepthRange) * 0.5;

    const column0Row0 = halfWidth;
    const column1Row1 = halfHeight;
    const column2Row2 = halfDepth;
    const column3Row0 = x + halfWidth;
    const column3Row1 = y + halfHeight;
    const column3Row2 = nearDepthRange + halfDepth;
    const column3Row3 = 1.0;

    result._data[0] = column0Row0;
    result._data[1] = 0.0;
    result._data[2] = 0.0;
    result._data[3] = 0.0;
    result._data[4] = 0.0;
    result._data[5] = column1Row1;
    result._data[6] = 0.0;
    result._data[7] = 0.0;
    result._data[8] = 0.0;
    result._data[9] = 0.0;
    result._data[10] = column2Row2;
    result._data[11] = 0.0;
    result._data[12] = column3Row0;
    result._data[13] = column3Row1;
    result._data[14] = column3Row2;
    result._data[15] = column3Row3;

    return result;
  }

  static computeView (position: Vector3, direction: Vector3, up: Vector3, right: Vector3, result: Matrix4) {
    result._data[0] = right.x;
    result._data[1] = up.x;
    result._data[2] = -direction.x;
    result._data[3] = 0.0;
    result._data[4] = right.y;
    result._data[5] = up.y;
    result._data[6] = -direction.y;
    result._data[7] = 0.0;
    result._data[8] = right.z;
    result._data[9] = up.z;
    result._data[10] = -direction.z;
    result._data[11] = 0.0;
    result._data[12] = -Vector3.dot(right, position);
    result._data[13] = -Vector3.dot(up, position);
    result._data[14] = Vector3.dot(direction, position);
    result._data[15] = 1.0;

    return result;
  }

  static toArray (matrix: Matrix4, result: Mat4DataType) {
    result[0] = matrix._data[0];
    result[1] = matrix._data[1];
    result[2] = matrix._data[2];
    result[3] = matrix._data[3];
    result[4] = matrix._data[4];
    result[5] = matrix._data[5];
    result[6] = matrix._data[6];
    result[7] = matrix._data[7];
    result[8] = matrix._data[8];
    result[9] = matrix._data[9];
    result[10] = matrix._data[10];
    result[11] = matrix._data[11];
    result[12] = matrix._data[12];
    result[13] = matrix._data[13];
    result[14] = matrix._data[14];
    result[15] = matrix._data[15];

    return result;
  }

  static getElement (matrix: Matrix4, column: number, row: number) {
    return matrix._data[column * 4 + row];
  }

  static getColumn (matrix: Matrix4, index: number, result: Vector4) {
    const startIndex = index * 4;
    const x = matrix._data[startIndex];
    const y = matrix._data[startIndex + 1];
    const z = matrix._data[startIndex + 2];
    const w = matrix._data[startIndex + 3];

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  static setColumn (matrix: Matrix4, index: number, cartesian: Vector4, result: Matrix4) {
    result = Matrix4.copyTo(matrix, result);

    const startIndex = index * 4;

    result._data[startIndex] = cartesian.x;
    result._data[startIndex + 1] = cartesian.y;
    result._data[startIndex + 2] = cartesian.z;
    result._data[startIndex + 3] = cartesian.w;

    return result;
  }

  static getRow (matrix: Matrix4, index: number, result: Vector4) {
    const x = matrix._data[index];
    const y = matrix._data[index + 4];
    const z = matrix._data[index + 8];
    const w = matrix._data[index + 12];

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  static setRow (matrix: Matrix4, index: number, cartesian: Vector4, result: Matrix4) {
    result = Matrix4.copyTo(matrix, result);
    result._data[index] = cartesian.x;
    result._data[index + 4] = cartesian.y;
    result._data[index + 8] = cartesian.z;
    result._data[index + 12] = cartesian.w;

    return result;
  }

  static setTranslation (matrix: Matrix4, translation: Vector3, result: Matrix4) {
    result._data[0] = matrix._data[0];
    result._data[1] = matrix._data[1];
    result._data[2] = matrix._data[2];
    result._data[3] = matrix._data[3];

    result._data[4] = matrix._data[4];
    result._data[5] = matrix._data[5];
    result._data[6] = matrix._data[6];
    result._data[7] = matrix._data[7];

    result._data[8] = matrix._data[8];
    result._data[9] = matrix._data[9];
    result._data[10] = matrix._data[10];
    result._data[11] = matrix._data[11];

    result._data[12] = translation.x;
    result._data[13] = translation.y;
    result._data[14] = translation.z;
    result._data[15] = matrix._data[15];

    return result;
  }

  static scale (matrix: Matrix4, scale: Vector3, result: Matrix4) {
    const existingScale = Matrix4.getScale(matrix, scaleScratch1);
    const scaleRatioX = scale.x / existingScale.x;
    const scaleRatioY = scale.y / existingScale.y;
    const scaleRatioZ = scale.z / existingScale.y;

    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioX;
    result._data[3] = matrix._data[3];

    result._data[4] = matrix._data[4] * scaleRatioY;
    result._data[5] = matrix._data[5] * scaleRatioY;
    result._data[6] = matrix._data[6] * scaleRatioY;
    result._data[7] = matrix._data[7];

    result._data[8] = matrix._data[8] * scaleRatioZ;
    result._data[9] = matrix._data[9] * scaleRatioZ;
    result._data[10] = matrix._data[10] * scaleRatioZ;
    result._data[11] = matrix._data[11];

    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static setUniformScale (matrix: Matrix4, scale: number, result: Matrix4) {
    const existingScale = Matrix4.getScale(matrix, scaleScratch2);
    const scaleRatioX = scale / existingScale.x;
    const scaleRatioY = scale / existingScale.y;
    const scaleRatioZ = scale / existingScale.z;

    result._data[0] = matrix._data[0] * scaleRatioX;
    result._data[1] = matrix._data[1] * scaleRatioX;
    result._data[2] = matrix._data[2] * scaleRatioX;
    result._data[3] = matrix._data[3];

    result._data[4] = matrix._data[4] * scaleRatioY;
    result._data[5] = matrix._data[5] * scaleRatioY;
    result._data[6] = matrix._data[6] * scaleRatioY;
    result._data[7] = matrix._data[7];

    result._data[8] = matrix._data[8] * scaleRatioZ;
    result._data[9] = matrix._data[9] * scaleRatioZ;
    result._data[10] = matrix._data[10] * scaleRatioZ;
    result._data[11] = matrix._data[11];

    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static getScale (matrix: Matrix4, result: Vector3) {
    result.x = Math.hypot(matrix._data[0], matrix._data[1], matrix._data[2]);
    result.y = Math.hypot(matrix._data[4], matrix._data[5], matrix._data[6]);
    result.z = Math.hypot(matrix._data[8], matrix._data[9], matrix._data[10]);

    return result;
  }

  static getMaximumScale (matrix: Matrix4) {
    Matrix4.getScale(matrix, scaleScratch3);

    return Vector3.maximumComponent(scaleScratch3);
  }

  static setRotation (matrix: Matrix4, rotation: Matrix4, result: Matrix4) {
    const scale = Matrix4.getScale(matrix, scaleScratch4);

    result._data[0] = rotation._data[0] * scale.x;
    result._data[1] = rotation._data[1] * scale.x;
    result._data[2] = rotation._data[2] * scale.x;
    result._data[3] = matrix._data[3];

    result._data[4] = rotation._data[3] * scale.y;
    result._data[5] = rotation._data[4] * scale.y;
    result._data[6] = rotation._data[5] * scale.y;
    result._data[7] = matrix._data[7];

    result._data[8] = rotation._data[6] * scale.z;
    result._data[9] = rotation._data[7] * scale.z;
    result._data[10] = rotation._data[8] * scale.z;
    result._data[11] = matrix._data[11];

    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static getRotation (matrix: Matrix4, result: Matrix4) {
    const scale = Matrix4.getScale(matrix, scaleScratch5);

    result._data[0] = matrix._data[0] / scale.x;
    result._data[1] = matrix._data[1] / scale.x;
    result._data[2] = matrix._data[2] / scale.x;

    result._data[3] = matrix._data[4] / scale.y;
    result._data[4] = matrix._data[5] / scale.y;
    result._data[5] = matrix._data[6] / scale.y;

    result._data[6] = matrix._data[8] / scale.z;
    result._data[7] = matrix._data[9] / scale.z;
    result._data[8] = matrix._data[10] / scale.z;

    return result;
  }

  static getRotationMatrix3 (matrix: Matrix4, result: Matrix3) {
    const scale = Matrix4.getScale(matrix, scaleScratch5);

    result.getData()[0] = matrix._data[0] / scale.x;
    result.getData()[1] = matrix._data[1] / scale.x;
    result.getData()[2] = matrix._data[2] / scale.x;

    result.getData()[3] = matrix._data[4] / scale.y;
    result.getData()[4] = matrix._data[5] / scale.y;
    result.getData()[5] = matrix._data[6] / scale.y;

    result.getData()[6] = matrix._data[8] / scale.z;
    result.getData()[7] = matrix._data[9] / scale.z;
    result.getData()[8] = matrix._data[10] / scale.z;

    return result;
  }

  static getRotationQuaternion (matrix: Matrix4, result: Quaternion) {
    Matrix4.getRotationMatrix3(matrix, scratchMat2Quat);
    result = Quaternion.fromRotationMatrix(scratchMat2Quat, result);

    return result;
  }

  static multiply (leftM: Matrix4, rightM: Matrix4, result: Matrix4) {
    const left = leftM._data;
    const right = rightM._data;

    const left0 = left[0];
    const left1 = left[1];
    const left2 = left[2];
    const left3 = left[3];
    const left4 = left[4];
    const left5 = left[5];
    const left6 = left[6];
    const left7 = left[7];
    const left8 = left[8];
    const left9 = left[9];
    const left10 = left[10];
    const left11 = left[11];
    const left12 = left[12];
    const left13 = left[13];
    const left14 = left[14];
    const left15 = left[15];

    const right0 = right[0];
    const right1 = right[1];
    const right2 = right[2];
    const right3 = right[3];
    const right4 = right[4];
    const right5 = right[5];
    const right6 = right[6];
    const right7 = right[7];
    const right8 = right[8];
    const right9 = right[9];
    const right10 = right[10];
    const right11 = right[11];
    const right12 = right[12];
    const right13 = right[13];
    const right14 = right[14];
    const right15 = right[15];

    const column0Row0 =
      left0 * right0 + left4 * right1 + left8 * right2 + left12 * right3;
    const column0Row1 =
      left1 * right0 + left5 * right1 + left9 * right2 + left13 * right3;
    const column0Row2 =
      left2 * right0 + left6 * right1 + left10 * right2 + left14 * right3;
    const column0Row3 =
      left3 * right0 + left7 * right1 + left11 * right2 + left15 * right3;

    const column1Row0 =
      left0 * right4 + left4 * right5 + left8 * right6 + left12 * right7;
    const column1Row1 =
      left1 * right4 + left5 * right5 + left9 * right6 + left13 * right7;
    const column1Row2 =
      left2 * right4 + left6 * right5 + left10 * right6 + left14 * right7;
    const column1Row3 =
      left3 * right4 + left7 * right5 + left11 * right6 + left15 * right7;

    const column2Row0 =
      left0 * right8 + left4 * right9 + left8 * right10 + left12 * right11;
    const column2Row1 =
      left1 * right8 + left5 * right9 + left9 * right10 + left13 * right11;
    const column2Row2 =
      left2 * right8 + left6 * right9 + left10 * right10 + left14 * right11;
    const column2Row3 =
      left3 * right8 + left7 * right9 + left11 * right10 + left15 * right11;

    const column3Row0 =
      left0 * right12 + left4 * right13 + left8 * right14 + left12 * right15;
    const column3Row1 =
      left1 * right12 + left5 * right13 + left9 * right14 + left13 * right15;
    const column3Row2 =
      left2 * right12 + left6 * right13 + left10 * right14 + left14 * right15;
    const column3Row3 =
      left3 * right12 + left7 * right13 + left11 * right14 + left15 * right15;

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column0Row2;
    result._data[3] = column0Row3;
    result._data[4] = column1Row0;
    result._data[5] = column1Row1;
    result._data[6] = column1Row2;
    result._data[7] = column1Row3;
    result._data[8] = column2Row0;
    result._data[9] = column2Row1;
    result._data[10] = column2Row2;
    result._data[11] = column2Row3;
    result._data[12] = column3Row0;
    result._data[13] = column3Row1;
    result._data[14] = column3Row2;
    result._data[15] = column3Row3;

    return result;
  }

  static mulScalerAddMatrix (leftM: Matrix4, rightM: Matrix4, rightS: number, result: Matrix4) {
    const left = leftM._data;
    const right = rightM._data;
    const target = result._data;

    for (let i = 0; i < 16; i++) {
      target[i] = left[i] + right[i] * rightS;
    }

    return result;
  }

  static add (left: Matrix4, right: Matrix4, result: Matrix4) {
    result._data[0] = left._data[0] + right._data[0];
    result._data[1] = left._data[1] + right._data[1];
    result._data[2] = left._data[2] + right._data[2];
    result._data[3] = left._data[3] + right._data[3];
    result._data[4] = left._data[4] + right._data[4];
    result._data[5] = left._data[5] + right._data[5];
    result._data[6] = left._data[6] + right._data[6];
    result._data[7] = left._data[7] + right._data[7];
    result._data[8] = left._data[8] + right._data[8];
    result._data[9] = left._data[9] + right._data[9];
    result._data[10] = left._data[10] + right._data[10];
    result._data[11] = left._data[11] + right._data[11];
    result._data[12] = left._data[12] + right._data[12];
    result._data[13] = left._data[13] + right._data[13];
    result._data[14] = left._data[14] + right._data[14];
    result._data[15] = left._data[15] + right._data[15];

    return result;
  }

  static subtract (left: Matrix4, right: Matrix4, result: Matrix4) {
    result._data[0] = left._data[0] - right._data[0];
    result._data[1] = left._data[1] - right._data[1];
    result._data[2] = left._data[2] - right._data[2];
    result._data[3] = left._data[3] - right._data[3];
    result._data[4] = left._data[4] - right._data[4];
    result._data[5] = left._data[5] - right._data[5];
    result._data[6] = left._data[6] - right._data[6];
    result._data[7] = left._data[7] - right._data[7];
    result._data[8] = left._data[8] - right._data[8];
    result._data[9] = left._data[9] - right._data[9];
    result._data[10] = left._data[10] - right._data[10];
    result._data[11] = left._data[11] - right._data[11];
    result._data[12] = left._data[12] - right._data[12];
    result._data[13] = left._data[13] - right._data[13];
    result._data[14] = left._data[14] - right._data[14];
    result._data[15] = left._data[15] - right._data[15];

    return result;
  }

  static multiplyTransformation (leftM: Matrix4, rightM: Matrix4, result: Matrix4) {
    const left = leftM._data;
    const right = leftM._data;

    const left0 = left[0];
    const left1 = left[1];
    const left2 = left[2];
    const left4 = left[4];
    const left5 = left[5];
    const left6 = left[6];
    const left8 = left[8];
    const left9 = left[9];
    const left10 = left[10];
    const left12 = left[12];
    const left13 = left[13];
    const left14 = left[14];

    const right0 = right[0];
    const right1 = right[1];
    const right2 = right[2];
    const right4 = right[4];
    const right5 = right[5];
    const right6 = right[6];
    const right8 = right[8];
    const right9 = right[9];
    const right10 = right[10];
    const right12 = right[12];
    const right13 = right[13];
    const right14 = right[14];

    const column0Row0 = left0 * right0 + left4 * right1 + left8 * right2;
    const column0Row1 = left1 * right0 + left5 * right1 + left9 * right2;
    const column0Row2 = left2 * right0 + left6 * right1 + left10 * right2;

    const column1Row0 = left0 * right4 + left4 * right5 + left8 * right6;
    const column1Row1 = left1 * right4 + left5 * right5 + left9 * right6;
    const column1Row2 = left2 * right4 + left6 * right5 + left10 * right6;

    const column2Row0 = left0 * right8 + left4 * right9 + left8 * right10;
    const column2Row1 = left1 * right8 + left5 * right9 + left9 * right10;
    const column2Row2 = left2 * right8 + left6 * right9 + left10 * right10;

    const column3Row0 =
      left0 * right12 + left4 * right13 + left8 * right14 + left12;
    const column3Row1 =
      left1 * right12 + left5 * right13 + left9 * right14 + left13;
    const column3Row2 =
      left2 * right12 + left6 * right13 + left10 * right14 + left14;

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column0Row2;
    result._data[3] = 0.0;
    result._data[4] = column1Row0;
    result._data[5] = column1Row1;
    result._data[6] = column1Row2;
    result._data[7] = 0.0;
    result._data[8] = column2Row0;
    result._data[9] = column2Row1;
    result._data[10] = column2Row2;
    result._data[11] = 0.0;
    result._data[12] = column3Row0;
    result._data[13] = column3Row1;
    result._data[14] = column3Row2;
    result._data[15] = 1.0;

    return result;
  }

  static multiplyByMatrix3 (matrix: Matrix4, rotation: Matrix3, result: Matrix4) {
    const left0 = matrix._data[0];
    const left1 = matrix._data[1];
    const left2 = matrix._data[2];
    const left4 = matrix._data[4];
    const left5 = matrix._data[5];
    const left6 = matrix._data[6];
    const left8 = matrix._data[8];
    const left9 = matrix._data[9];
    const left10 = matrix._data[10];

    const right0 = rotation.getData()[0];
    const right1 = rotation.getData()[1];
    const right2 = rotation.getData()[2];
    const right4 = rotation.getData()[3];
    const right5 = rotation.getData()[4];
    const right6 = rotation.getData()[5];
    const right8 = rotation.getData()[6];
    const right9 = rotation.getData()[7];
    const right10 = rotation.getData()[8];

    const column0Row0 = left0 * right0 + left4 * right1 + left8 * right2;
    const column0Row1 = left1 * right0 + left5 * right1 + left9 * right2;
    const column0Row2 = left2 * right0 + left6 * right1 + left10 * right2;

    const column1Row0 = left0 * right4 + left4 * right5 + left8 * right6;
    const column1Row1 = left1 * right4 + left5 * right5 + left9 * right6;
    const column1Row2 = left2 * right4 + left6 * right5 + left10 * right6;

    const column2Row0 = left0 * right8 + left4 * right9 + left8 * right10;
    const column2Row1 = left1 * right8 + left5 * right9 + left9 * right10;
    const column2Row2 = left2 * right8 + left6 * right9 + left10 * right10;

    result._data[0] = column0Row0;
    result._data[1] = column0Row1;
    result._data[2] = column0Row2;
    result._data[3] = 0.0;
    result._data[4] = column1Row0;
    result._data[5] = column1Row1;
    result._data[6] = column1Row2;
    result._data[7] = 0.0;
    result._data[8] = column2Row0;
    result._data[9] = column2Row1;
    result._data[10] = column2Row2;
    result._data[11] = 0.0;
    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static multiplyByTranslation (matrix: Matrix4, translation: Vector3, result: Matrix4) {
    const x = translation.x;
    const y = translation.y;
    const z = translation.z;

    const tx = x * matrix._data[0] + y * matrix._data[4] + z * matrix._data[8] + matrix._data[12];
    const ty = x * matrix._data[1] + y * matrix._data[5] + z * matrix._data[9] + matrix._data[13];
    const tz = x * matrix._data[2] + y * matrix._data[6] + z * matrix._data[10] + matrix._data[14];

    result._data[0] = matrix._data[0];
    result._data[1] = matrix._data[1];
    result._data[2] = matrix._data[2];
    result._data[3] = matrix._data[3];
    result._data[4] = matrix._data[4];
    result._data[5] = matrix._data[5];
    result._data[6] = matrix._data[6];
    result._data[7] = matrix._data[7];
    result._data[8] = matrix._data[8];
    result._data[9] = matrix._data[9];
    result._data[10] = matrix._data[10];
    result._data[11] = matrix._data[11];
    result._data[12] = tx;
    result._data[13] = ty;
    result._data[14] = tz;
    result._data[15] = matrix._data[15];

    return result;
  }

  static multiplyByScale (matrix: Matrix4, scale: Vector3, result: Matrix4) {
    const scaleX = scale.x;
    const scaleY = scale.y;
    const scaleZ = scale.z;

    // Faster than Cartesian3.equals
    if (scaleX === 1.0 && scaleY === 1.0 && scaleZ === 1.0) {
      return Matrix4.copyTo(matrix, result);
    }

    if (result === undefined) {
      result = new Matrix4();
    }

    result._data[0] = scaleX * matrix._data[0];
    result._data[1] = scaleX * matrix._data[1];
    result._data[2] = scaleX * matrix._data[2];
    result._data[3] = matrix._data[3];

    result._data[4] = scaleY * matrix._data[4];
    result._data[5] = scaleY * matrix._data[5];
    result._data[6] = scaleY * matrix._data[6];
    result._data[7] = matrix._data[7];

    result._data[8] = scaleZ * matrix._data[8];
    result._data[9] = scaleZ * matrix._data[9];
    result._data[10] = scaleZ * matrix._data[10];
    result._data[11] = matrix._data[11];

    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static multiplyByUniformScale (matrix: Matrix4, scale: number, result: Matrix4) {
    result._data[0] = matrix._data[0] * scale;
    result._data[1] = matrix._data[1] * scale;
    result._data[2] = matrix._data[2] * scale;
    result._data[3] = matrix._data[3];

    result._data[4] = matrix._data[4] * scale;
    result._data[5] = matrix._data[5] * scale;
    result._data[6] = matrix._data[6] * scale;
    result._data[7] = matrix._data[7];

    result._data[8] = matrix._data[8] * scale;
    result._data[9] = matrix._data[9] * scale;
    result._data[10] = matrix._data[10] * scale;
    result._data[11] = matrix._data[11];

    result._data[12] = matrix._data[12];
    result._data[13] = matrix._data[13];
    result._data[14] = matrix._data[14];
    result._data[15] = matrix._data[15];

    return result;
  }

  static multiplyByVector (matrix: Matrix4, cartesian: Vector4, result: Vector4) {
    const vX = cartesian.x;
    const vY = cartesian.y;
    const vZ = cartesian.z;
    const vW = cartesian.w;

    const x = matrix._data[0] * vX + matrix._data[4] * vY + matrix._data[8] * vZ + matrix._data[12] * vW;
    const y = matrix._data[1] * vX + matrix._data[5] * vY + matrix._data[9] * vZ + matrix._data[13] * vW;
    const z = matrix._data[2] * vX + matrix._data[6] * vY + matrix._data[10] * vZ + matrix._data[14] * vW;
    const w = matrix._data[3] * vX + matrix._data[7] * vY + matrix._data[11] * vZ + matrix._data[15] * vW;

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  static multiplyByPointAsVector (matrix: Matrix4, cartesian: Vector3, result: Vector3) {
    const vX = cartesian.x;
    const vY = cartesian.y;
    const vZ = cartesian.z;

    const x = matrix._data[0] * vX + matrix._data[4] * vY + matrix._data[8] * vZ;
    const y = matrix._data[1] * vX + matrix._data[5] * vY + matrix._data[9] * vZ;
    const z = matrix._data[2] * vX + matrix._data[6] * vY + matrix._data[10] * vZ;

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  /**
   * 矩阵与三维点/向量相乘，三维点/向量第四个分量 W 为 1 处理
   * @param matrix
   * @param cartesian
   * @param result
   * @returns
   */
  static multiplyByPoint (matrix: Matrix4, cartesian: Vector3, result: Vector3) {
    const vX = cartesian.x;
    const vY = cartesian.y;
    const vZ = cartesian.z;

    const x = matrix._data[0] * vX + matrix._data[4] * vY + matrix._data[8] * vZ + matrix._data[12];
    const y = matrix._data[1] * vX + matrix._data[5] * vY + matrix._data[9] * vZ + matrix._data[13];
    const z = matrix._data[2] * vX + matrix._data[6] * vY + matrix._data[10] * vZ + matrix._data[14];

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static multiplyByScalar (matrix: Matrix4, scalar: number, result: Matrix4) {
    result._data[0] = matrix._data[0] * scalar;
    result._data[1] = matrix._data[1] * scalar;
    result._data[2] = matrix._data[2] * scalar;
    result._data[3] = matrix._data[3] * scalar;
    result._data[4] = matrix._data[4] * scalar;
    result._data[5] = matrix._data[5] * scalar;
    result._data[6] = matrix._data[6] * scalar;
    result._data[7] = matrix._data[7] * scalar;
    result._data[8] = matrix._data[8] * scalar;
    result._data[9] = matrix._data[9] * scalar;
    result._data[10] = matrix._data[10] * scalar;
    result._data[11] = matrix._data[11] * scalar;
    result._data[12] = matrix._data[12] * scalar;
    result._data[13] = matrix._data[13] * scalar;
    result._data[14] = matrix._data[14] * scalar;
    result._data[15] = matrix._data[15] * scalar;

    return result;
  }

  static negate (matrix: Matrix4, result: Matrix4) {
    result._data[0] = -matrix._data[0];
    result._data[1] = -matrix._data[1];
    result._data[2] = -matrix._data[2];
    result._data[3] = -matrix._data[3];
    result._data[4] = -matrix._data[4];
    result._data[5] = -matrix._data[5];
    result._data[6] = -matrix._data[6];
    result._data[7] = -matrix._data[7];
    result._data[8] = -matrix._data[8];
    result._data[9] = -matrix._data[9];
    result._data[10] = -matrix._data[10];
    result._data[11] = -matrix._data[11];
    result._data[12] = -matrix._data[12];
    result._data[13] = -matrix._data[13];
    result._data[14] = -matrix._data[14];
    result._data[15] = -matrix._data[15];

    return result;
  }

  static transpose (matrix: Matrix4, result: Matrix4) {
    const matrix1 = matrix._data[1];
    const matrix2 = matrix._data[2];
    const matrix3 = matrix._data[3];
    const matrix6 = matrix._data[6];
    const matrix7 = matrix._data[7];
    const matrix11 = matrix._data[11];

    result._data[0] = matrix._data[0];
    result._data[1] = matrix._data[4];
    result._data[2] = matrix._data[8];
    result._data[3] = matrix._data[12];
    result._data[4] = matrix1;
    result._data[5] = matrix._data[5];
    result._data[6] = matrix._data[9];
    result._data[7] = matrix._data[13];
    result._data[8] = matrix2;
    result._data[9] = matrix6;
    result._data[10] = matrix._data[10];
    result._data[11] = matrix._data[14];
    result._data[12] = matrix3;
    result._data[13] = matrix7;
    result._data[14] = matrix11;
    result._data[15] = matrix._data[15];

    return result;
  }

  static abs (matrix: Matrix4, result: Matrix4) {
    result._data[0] = Math.abs(matrix._data[0]);
    result._data[1] = Math.abs(matrix._data[1]);
    result._data[2] = Math.abs(matrix._data[2]);
    result._data[3] = Math.abs(matrix._data[3]);
    result._data[4] = Math.abs(matrix._data[4]);
    result._data[5] = Math.abs(matrix._data[5]);
    result._data[6] = Math.abs(matrix._data[6]);
    result._data[7] = Math.abs(matrix._data[7]);
    result._data[8] = Math.abs(matrix._data[8]);
    result._data[9] = Math.abs(matrix._data[9]);
    result._data[10] = Math.abs(matrix._data[10]);
    result._data[11] = Math.abs(matrix._data[11]);
    result._data[12] = Math.abs(matrix._data[12]);
    result._data[13] = Math.abs(matrix._data[13]);
    result._data[14] = Math.abs(matrix._data[14]);
    result._data[15] = Math.abs(matrix._data[15]);

    return result;
  }

  static equals (left: Matrix4, right: Matrix4) {
    // Given that most matrices will be transformation matrices, the elements
    // are tested in order such that the test is likely to fail as early
    // as possible.  I _think_ this is just as friendly to the L1 cache
    // as testing in index order.  It is certainty faster in practice.
    return (
      left === right ||
      (
        // Translation
        left._data[12] === right._data[12] &&
        left._data[13] === right._data[13] &&
        left._data[14] === right._data[14] &&
        // Rotation/scale
        left._data[0] === right._data[0] &&
        left._data[1] === right._data[1] &&
        left._data[2] === right._data[2] &&
        left._data[4] === right._data[4] &&
        left._data[5] === right._data[5] &&
        left._data[6] === right._data[6] &&
        left._data[8] === right._data[8] &&
        left._data[9] === right._data[9] &&
        left._data[10] === right._data[10] &&
        // Bottom row
        left._data[3] === right._data[3] &&
        left._data[7] === right._data[7] &&
        left._data[11] === right._data[11] &&
        left._data[15] === right._data[15])
    );
  }

  static equalsEpsilon (left: Matrix4, right: Matrix4, epsilon: number) {
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
        Math.abs(left._data[8] - right._data[8]) <= epsilon &&
        Math.abs(left._data[9] - right._data[9]) <= epsilon &&
        Math.abs(left._data[10] - right._data[10]) <= epsilon &&
        Math.abs(left._data[11] - right._data[11]) <= epsilon &&
        Math.abs(left._data[12] - right._data[12]) <= epsilon &&
        Math.abs(left._data[13] - right._data[13]) <= epsilon &&
        Math.abs(left._data[14] - right._data[14]) <= epsilon &&
        Math.abs(left._data[15] - right._data[15]) <= epsilon)
    );
  }

  static getTranslation (matrix: Matrix4, result: Vector3) {
    result.x = matrix._data[12];
    result.y = matrix._data[13];
    result.z = matrix._data[14];

    return result;
  }

  static getMatrix3 (matrix: Matrix4, result: Matrix3) {
    result.getData()[0] = matrix._data[0];
    result.getData()[1] = matrix._data[1];
    result.getData()[2] = matrix._data[2];
    result.getData()[3] = matrix._data[4];
    result.getData()[4] = matrix._data[5];
    result.getData()[5] = matrix._data[6];
    result.getData()[6] = matrix._data[8];
    result.getData()[7] = matrix._data[9];
    result.getData()[8] = matrix._data[10];

    return result;
  }

  static inverse (matrix: Matrix4, result: Matrix4) {
    //
    // Ported from:
    //   ftp://download.intel.com/design/PentiumIII/sml/24504301.pdf
    //
    const src0 = matrix._data[0];
    const src1 = matrix._data[4];
    const src2 = matrix._data[8];
    const src3 = matrix._data[12];
    const src4 = matrix._data[1];
    const src5 = matrix._data[5];
    const src6 = matrix._data[9];
    const src7 = matrix._data[13];
    const src8 = matrix._data[2];
    const src9 = matrix._data[6];
    const src10 = matrix._data[10];
    const src11 = matrix._data[14];
    const src12 = matrix._data[3];
    const src13 = matrix._data[7];
    const src14 = matrix._data[11];
    const src15 = matrix._data[15];

    // calculate pairs for first 8 elements (cofactors)
    let tmp0 = src10 * src15;
    let tmp1 = src11 * src14;
    let tmp2 = src9 * src15;
    let tmp3 = src11 * src13;
    let tmp4 = src9 * src14;
    let tmp5 = src10 * src13;
    let tmp6 = src8 * src15;
    let tmp7 = src11 * src12;
    let tmp8 = src8 * src14;
    let tmp9 = src10 * src12;
    let tmp10 = src8 * src13;
    let tmp11 = src9 * src12;

    // calculate first 8 elements (cofactors)
    const dst0 =
      tmp0 * src5 +
      tmp3 * src6 +
      tmp4 * src7 -
      (tmp1 * src5 + tmp2 * src6 + tmp5 * src7);
    const dst1 =
      tmp1 * src4 +
      tmp6 * src6 +
      tmp9 * src7 -
      (tmp0 * src4 + tmp7 * src6 + tmp8 * src7);
    const dst2 =
      tmp2 * src4 +
      tmp7 * src5 +
      tmp10 * src7 -
      (tmp3 * src4 + tmp6 * src5 + tmp11 * src7);
    const dst3 =
      tmp5 * src4 +
      tmp8 * src5 +
      tmp11 * src6 -
      (tmp4 * src4 + tmp9 * src5 + tmp10 * src6);
    const dst4 =
      tmp1 * src1 +
      tmp2 * src2 +
      tmp5 * src3 -
      (tmp0 * src1 + tmp3 * src2 + tmp4 * src3);
    const dst5 =
      tmp0 * src0 +
      tmp7 * src2 +
      tmp8 * src3 -
      (tmp1 * src0 + tmp6 * src2 + tmp9 * src3);
    const dst6 =
      tmp3 * src0 +
      tmp6 * src1 +
      tmp11 * src3 -
      (tmp2 * src0 + tmp7 * src1 + tmp10 * src3);
    const dst7 =
      tmp4 * src0 +
      tmp9 * src1 +
      tmp10 * src2 -
      (tmp5 * src0 + tmp8 * src1 + tmp11 * src2);

    // calculate pairs for second 8 elements (cofactors)
    tmp0 = src2 * src7;
    tmp1 = src3 * src6;
    tmp2 = src1 * src7;
    tmp3 = src3 * src5;
    tmp4 = src1 * src6;
    tmp5 = src2 * src5;
    tmp6 = src0 * src7;
    tmp7 = src3 * src4;
    tmp8 = src0 * src6;
    tmp9 = src2 * src4;
    tmp10 = src0 * src5;
    tmp11 = src1 * src4;

    // calculate second 8 elements (cofactors)
    const dst8 =
      tmp0 * src13 +
      tmp3 * src14 +
      tmp4 * src15 -
      (tmp1 * src13 + tmp2 * src14 + tmp5 * src15);
    const dst9 =
      tmp1 * src12 +
      tmp6 * src14 +
      tmp9 * src15 -
      (tmp0 * src12 + tmp7 * src14 + tmp8 * src15);
    const dst10 =
      tmp2 * src12 +
      tmp7 * src13 +
      tmp10 * src15 -
      (tmp3 * src12 + tmp6 * src13 + tmp11 * src15);
    const dst11 =
      tmp5 * src12 +
      tmp8 * src13 +
      tmp11 * src14 -
      (tmp4 * src12 + tmp9 * src13 + tmp10 * src14);
    const dst12 =
      tmp2 * src10 +
      tmp5 * src11 +
      tmp1 * src9 -
      (tmp4 * src11 + tmp0 * src9 + tmp3 * src10);
    const dst13 =
      tmp8 * src11 +
      tmp0 * src8 +
      tmp7 * src10 -
      (tmp6 * src10 + tmp9 * src11 + tmp1 * src8);
    const dst14 =
      tmp6 * src9 +
      tmp11 * src11 +
      tmp3 * src8 -
      (tmp10 * src11 + tmp2 * src8 + tmp7 * src9);
    const dst15 =
      tmp10 * src10 +
      tmp4 * src8 +
      tmp9 * src9 -
      (tmp8 * src9 + tmp11 * src10 + tmp5 * src8);

    // calculate determinant
    let det = src0 * dst0 + src1 * dst1 + src2 * dst2 + src3 * dst3;

    if (Math.abs(det) < MathUtils.EPSILON21) {
      // Special case for a zero scale matrix that can occur, for example,
      // when a model's node has a [0, 0, 0] scale.
      if (
        Matrix3.equalsEpsilon(
          Matrix4.getMatrix3(matrix, scratchInverseRotation),
          scratchMatrix3Zero,
          MathUtils.EPSILON7
        ) &&
        Vector4.equals(
          Matrix4.getRow(matrix, 3, scratchBottomRow),
          scratchExpectedBottomRow
        )
      ) {
        result._data[0] = 0.0;
        result._data[1] = 0.0;
        result._data[2] = 0.0;
        result._data[3] = 0.0;
        result._data[4] = 0.0;
        result._data[5] = 0.0;
        result._data[6] = 0.0;
        result._data[7] = 0.0;
        result._data[8] = 0.0;
        result._data[9] = 0.0;
        result._data[10] = 0.0;
        result._data[11] = 0.0;
        result._data[12] = -matrix._data[12];
        result._data[13] = -matrix._data[13];
        result._data[14] = -matrix._data[14];
        result._data[15] = 1.0;

        return result;
      }

      throw 'matrix is not invertible because its determinate is zero';
    }

    // calculate matrix inverse
    det = 1.0 / det;

    result._data[0] = dst0 * det;
    result._data[1] = dst1 * det;
    result._data[2] = dst2 * det;
    result._data[3] = dst3 * det;
    result._data[4] = dst4 * det;
    result._data[5] = dst5 * det;
    result._data[6] = dst6 * det;
    result._data[7] = dst7 * det;
    result._data[8] = dst8 * det;
    result._data[9] = dst9 * det;
    result._data[10] = dst10 * det;
    result._data[11] = dst11 * det;
    result._data[12] = dst12 * det;
    result._data[13] = dst13 * det;
    result._data[14] = dst14 * det;
    result._data[15] = dst15 * det;

    return result;
  }

  static inverseTransformation (matrix: Matrix4, result: Matrix4) {
    //This function is an optimized version of the below 4 lines.
    //const rT = Matrix3.transpose(Matrix4.getMatrix3(matrix));
    //const rTN = Matrix3.negate(rT);
    //const rTT = Matrix3.multiplyByVector(rTN, Matrix4.getTranslation(matrix));
    //return Matrix4.fromRotationTranslation(rT, rTT, result);
    const matrix0 = matrix._data[0];
    const matrix1 = matrix._data[1];
    const matrix2 = matrix._data[2];
    const matrix4 = matrix._data[4];
    const matrix5 = matrix._data[5];
    const matrix6 = matrix._data[6];
    const matrix8 = matrix._data[8];
    const matrix9 = matrix._data[9];
    const matrix10 = matrix._data[10];

    const vX = matrix._data[12];
    const vY = matrix._data[13];
    const vZ = matrix._data[14];

    const x = -matrix0 * vX - matrix1 * vY - matrix2 * vZ;
    const y = -matrix4 * vX - matrix5 * vY - matrix6 * vZ;
    const z = -matrix8 * vX - matrix9 * vY - matrix10 * vZ;

    result._data[0] = matrix0;
    result._data[1] = matrix4;
    result._data[2] = matrix8;
    result._data[3] = 0.0;
    result._data[4] = matrix1;
    result._data[5] = matrix5;
    result._data[6] = matrix9;
    result._data[7] = 0.0;
    result._data[8] = matrix2;
    result._data[9] = matrix6;
    result._data[10] = matrix10;
    result._data[11] = 0.0;
    result._data[12] = x;
    result._data[13] = y;
    result._data[14] = z;
    result._data[15] = 1.0;

    return result;
  }

  static inverseTranspose (matrix: Matrix4, result: Matrix4) {
    return Matrix4.inverse(
      Matrix4.transpose(matrix, scratchTransposeMatrix),
      result
    );
  }

  static equalsArray (matrix: Matrix4, array: Mat4DataType, offset?: number) {
    offset = offset ?? 0;

    return (
      matrix._data[0] === array[offset] &&
      matrix._data[1] === array[offset + 1] &&
      matrix._data[2] === array[offset + 2] &&
      matrix._data[3] === array[offset + 3] &&
      matrix._data[4] === array[offset + 4] &&
      matrix._data[5] === array[offset + 5] &&
      matrix._data[6] === array[offset + 6] &&
      matrix._data[7] === array[offset + 7] &&
      matrix._data[8] === array[offset + 8] &&
      matrix._data[9] === array[offset + 9] &&
      matrix._data[10] === array[offset + 10] &&
      matrix._data[11] === array[offset + 11] &&
      matrix._data[12] === array[offset + 12] &&
      matrix._data[13] === array[offset + 13] &&
      matrix._data[14] === array[offset + 14] &&
      matrix._data[15] === array[offset + 15]
    );
  }

  determinant (): number {
    const te = this._data;

    const n11 = te[0]; const n12 = te[4]; const n13 = te[8]; const n14 = te[12];
    const n21 = te[1]; const n22 = te[5]; const n23 = te[9]; const n24 = te[13];
    const n31 = te[2]; const n32 = te[6]; const n33 = te[10]; const n34 = te[14];
    const n41 = te[3]; const n42 = te[7]; const n43 = te[11]; const n44 = te[15];

    return (
      n41 * (
        + n14 * n23 * n32
        - n13 * n24 * n32
        - n14 * n22 * n33
        + n12 * n24 * n33
        + n13 * n22 * n34
        - n12 * n23 * n34
      ) +
      n42 * (
        + n11 * n23 * n34
        - n11 * n24 * n33
        + n14 * n21 * n33
        - n13 * n21 * n34
        + n13 * n24 * n31
        - n14 * n23 * n31
      ) +
      n43 * (
        + n11 * n24 * n32
        - n11 * n22 * n34
        - n14 * n21 * n32
        + n12 * n21 * n34
        + n14 * n22 * n31
        - n12 * n24 * n31
      ) +
      n44 * (
        - n13 * n22 * n31
        - n11 * n23 * n32
        + n11 * n22 * n33
        + n13 * n21 * n32
        - n12 * n21 * n33
        + n12 * n23 * n31
      )
    );
  }

  /**
   * 分解矩阵，将矩阵分解为平移、旋转、缩放三部分
   * @param m - 待分解的矩阵
   * @returns
   */
  static decompose (m: Matrix4): { translation: Vector3, rotation: Quaternion, scale: Vector3 } {
    const trans = Matrix4.getTranslation(m, new Vector3());
    const scale = Matrix4.getScale(m, new Vector3());
    // if determine is negative, we need to invert one scale
    const det = m.determinant();

    if (det < 0) { scale.x = - scale.x; }

    Matrix4.copyTo(m, _m1);

    const invSX = 1 / scale.x;
    const invSY = 1 / scale.y;
    const invSZ = 1 / scale.z;

    _m1._data[0] *= invSX;
    _m1._data[1] *= invSX;
    _m1._data[2] *= invSX;

    _m1._data[4] *= invSY;
    _m1._data[5] *= invSY;
    _m1._data[6] *= invSY;

    _m1._data[8] *= invSZ;
    _m1._data[9] *= invSZ;
    _m1._data[10] *= invSZ;

    const rotation = Matrix4.getRotationQuaternion(_m1, new Quaternion());

    return {
      translation: trans,
      rotation: rotation,
      scale: scale,
    };
  }

  /**
   * 从平移、旋转、缩放合成一个新变换矩阵
   * @param translation - 平移向量
   * @param rotation - 旋转量，使用四元数表示
   * @param scale - 缩放向量
   * @returns
   */
  static compose (translation: Vector3, rotation: Quaternion, scale: Vector3, result: Matrix4) {
    result = Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, result);

    return result;
  }

  /**
   * 计算透视投影矩阵
   * @param fovY
   * @param aspect
   * @param near
   * @param far
   * @returns
   */
  static computePerspective (fovY: number, aspect: number, near: number, far: number, reverse: boolean, result: Matrix4) {
    result = Matrix4.computePerspectiveFieldOfView(fovY, aspect, near, far, reverse, result);

    return result;
  }

  /**
   * 计算正交投影矩阵
   * @param left
   * @param right
   * @param bottom
   * @param top
   * @param near
   * @param far
   * @param result
   * @returns
   */
  static computeOrthographic (left: number, right: number, bottom: number, top: number, near: number, far: number, result: Matrix4) {
    result = Matrix4.computeOrthographicOffCenter(left, right, bottom, top, near, far, result);

    return result;
  }

  /**
   * 通过 LookAt 参数计算相机的视图矩阵
   * @param position
   * @param target
   * @param up
   * @param result
   * @returns
   */
  static computeLookAt (position: Vector3, target: Vector3, up: Vector3, result: Matrix4) {

    const direction = Vector3.subtract(target, position, new Vector3());

    result = Matrix4.fromCamera({
      position: position,
      direction: direction,
      up: up,
    }, result);

    return result;
  }

  /**
   * 使用矩阵内部数据构造一个新矩阵
   * @returns
   */
  clone () {
    const result = Matrix4.clone(this);

    return result;
  }

  /**
   * 将矩阵数据拷贝到 result 中
   * @param result
   * @returns
   */
  copyTo (result: Matrix4) {
    result = Matrix4.copyTo(this, result);

    return result;
  }

  /**
   * 将矩阵数据从 source 拷贝回来
   * @param source
   * @returns
   */
  copyFrom (source: Matrix4) {
    Matrix4.copyTo(source, this);

    return this;
  }

  /**
   * 平移矩阵，相当于该矩阵与使用 vector 构造的平移矩阵相乘
   * @param vector
   * @returns 🎯计算结果将保存在调用矩阵中，并作为函数返回值返回。
   */
  translate (vector: Vector3) {
    const result = Matrix4.multiplyByTranslation(this, vector, this);

    return result;
  }

  /**
   * 使用 vector 缩放矩阵，相当于该矩阵与使用 vector 构造的缩放矩阵相乘。
   * @param vector
   * @returns 🎯计算结果将保存在调用矩阵中，并作为函数返回值返回。
   */
  scale (vector: Vector3) {
    const result = Matrix4.scale(this, vector, this);

    return result;
  }

  /**
   * 计算矩阵与输入矩阵相乘的结果。
   * @param matrix
   * @returns 🎯计算结果将保存在调用矩阵中，并作为函数返回值返回。
   */
  multiply (matrix: Matrix4): Matrix4 {
    const result = Matrix4.multiply(this, matrix, this);

    return result;
  }

  /**
   * 将矩阵数据按照列主序导出为 number[] 对象。
   * @returns
   */
  toArray (): number[] {
    const array = new Array<number>(16);
    const result = Matrix4.toArray(this, array) as number[];

    return result;
  }

  /**
   * 将矩阵按照列主序方式导出为 Float32Array 对象。
   * @returns
   */
  toFloat32Array (): Float32Array {
    const result = Matrix4.pack(this, new Float32Array(16), 0) as Float32Array;

    return result;
  }

  /**
   * 矩阵与四维向量相乘。
   * @param vector
   * @returns
   */
  multiplyByVector4 (vector: Vector4) {
    const result = Matrix4.multiplyByVector(this, vector, new Vector4());

    return result;
  }

  /**
   * 矩阵与三维向量相乘，内部将三维向量第四个分量当作 1 来处理。
   * @param vector
   * @returns
   */
  multiplyByVector3 (vector: Vector3) {
    const result = Matrix4.multiplyByPoint(this, vector, new Vector3());

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
   * 矩阵乘一个旋转矩阵，矩阵乘一个绕 axis 轴旋转 angle 角度的旋转矩阵
   * @param angle
   * @param axis
   * @returns
   */
  rotate (angle: number, axis: Vector3): Matrix4 | undefined {
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
    const result = Matrix4.inverse(this, this);

    return result;
  }

  /**
   * 计算矩阵的转置，结果保存在原矩阵中（会修改矩阵数据）
   * @returns
   */
  transpose () {
    const result = Matrix4.transpose(this, this);

    return result;
  }

  /**
   * 4x4 单位矩阵
   */
  static IDENTITY = Object.freeze(
    new Matrix4(
      1.0,
      0.0,
      0.0,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      0.0,
      0.0,
      1.0
    )
  );

  /**
   * 数据都为 0 的矩阵
   */
  static ZERO = Object.freeze(
    new Matrix4(
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0
    )
  );
}

const fromCameraF = new Vector3();
const fromCameraR = new Vector3();
const fromCameraU = new Vector3();

const scaleScratch1 = new Vector3();

const scaleScratch2 = new Vector3();

const scratchColumn = new Vector3();

const scaleScratch3 = new Vector3();

const scaleScratch4 = new Vector3();

const scaleScratch5 = new Vector3();

const scratchInverseRotation = new Matrix3();
const scratchMatrix3Zero = new Matrix3();
const scratchBottomRow = new Vector4();
const scratchExpectedBottomRow = new Vector4(0.0, 0.0, 0.0, 1.0);
const scratchTransposeMatrix = new Matrix4();

const scratchMat2Quat = new Matrix3();

const _m1 = new Matrix4();

export { Matrix4 };

