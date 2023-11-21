import type { Vector3 } from './vector3';
import { Matrix4 } from './matrix4';
import { MathUtils } from './utilities';
import { Quaternion } from './quaternion';

/**
 * 欧拉角顺序，默认为 XYZ
 */
enum EulerOrder {
  'XYZ' = 0,
  'XZY' = 1,
  'YXZ' = 2,
  'YZX' = 3,
  'ZXY' = 4,
  'ZYX' = 5,
}

/**
 * 欧拉角
 */
class Euler {
  private _data: Float32Array;

  constructor (x = 0, y = 0, z = 0, private _order = EulerOrder.ZYX) {
    this._data = new Float32Array([x, y, z]);
  }

  get x (): number {
    return this._data[0];
  }
  set x (value: number) {
    this._data[0] = value;
  }

  getX (): number {
    return this._data[0];
  }

  setX (value: number) {
    this._data[0] = value;
  }

  get y (): number {
    return this._data[1];
  }
  set y (value: number) {
    this._data[1] = value;
  }

  getY (): number {
    return this._data[1];
  }

  setY (value: number) {
    this._data[1] = value;
  }

  get z (): number {
    return this._data[2];
  }
  set z (value: number) {
    this._data[2] = value;
  }

  getZ (): number {
    return this._data[2];
  }

  setZ (value: number) {
    this._data[2] = value;
  }

  get order (): EulerOrder {
    return this._order;
  }
  set order (value: EulerOrder) {
    this._order = value;
  }

  getOrder (): EulerOrder {
    return this._order;
  }

  setOrder (value: EulerOrder) {
    this._order = value;
  }

  set (x: number, y: number, z: number, order?: EulerOrder): Euler {
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    this._order = order === undefined ? EulerOrder.ZYX : order;

    return this;
  }

  /**
   * 使用欧拉角内部数据克隆出一个新的欧拉角
   * @returns
   */
  clone () {
    const result = Euler.clone(this);

    return result;
  }

  /**
   * 将欧拉角数据拷贝给 result
   * @param result
   * @returns
   */
  copyTo (result: Euler) {
    result = Euler.copyTo(this, result);

    return result;
  }

  /**
   * 将欧拉角数据从 source 拷贝回来
   * @param source
   * @returns
   */
  copyFrom (source: Euler) {
    Euler.copyTo(source, this);

    return this;
  }

  /**
   * 通过变换矩阵获取欧拉角
   * @param m
   * @param order
   * @returns
   */
  setFromRotationMatrix (m: Matrix4, order: EulerOrder = EulerOrder.XYZ): Euler {
    return Euler.setFromRotationMatrix(m, order, this);
  }

  /**
   * 通过四元数设置欧拉角
   * @param quat
   * @param order
   * @returns
   */
  setFromQuaternion (quat: Quaternion, order: EulerOrder = EulerOrder.XYZ): Euler {
    return Euler.setFromQuaternion(quat, order, this);
  }

  /**
   * 通过三维向量值设置欧拉角(无几何意义)
   * @param v
   * @param order
   * @returns
   */
  setFromVector3 (v: Vector3, order?: EulerOrder): Euler {
    return this.set(v.x, v.y, v.z, order || this._order);
  }

  /**
   * 修改欧拉角顺序
   * @param newOrder
   * @returns
   */
  reorder (newOrder: EulerOrder): Euler {
    return Euler.reorder(this, newOrder);
  }

  equals (euler: Euler): boolean {
    return (euler.x === this.x) && (euler.y === this.y) && (euler.z === this.z) && (euler._order === this._order);
  }

  /**
   * 通过数组设置欧拉角
   * @param array
   * @returns
   */
  fromArray (array: number[]): Euler {
    this.x = array[0];
    this.y = array[1];
    this.z = array[2];
    if (array[3] !== undefined) { this._order = array[3]; }

    return this;
  }

  /**
   * 将欧拉角保存为数组
   * @param array
   * @returns
   */
  toArray (array: number[] = [], offset = 0): number[] {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    array[offset + 3] = this._order;

    return array;
  }

  /**
   * 通过向量保存欧拉角
   * @param array
   * @returns
   */
  toVector3 (result: Vector3): Vector3 {
    result.set(this.x, this.y, this.z);

    return result;
  }

  /**
   * 从输入欧拉角克隆一个欧拉角
   * @param eular
   * @returns
   */
  static clone (eular: Euler) {
    const result = new Euler();

    result.x = eular.x;
    result.y = eular.y;
    result.z = eular.z;
    result.order = eular.order;

    return result;
  }

  /**
   * 欧拉角复制
   * @param eular
   * @param result
   * @returns
   */
  static copyTo (eular: Euler, result: Euler) {
    result.x = eular.x;
    result.y = eular.y;
    result.z = eular.z;
    result.order = eular.order;

    return result;
  }

  /**
   * 从矩阵中的旋转分量设置欧拉角
   * @param m
   * @param order
   * @param result
   * @returns
   */
  static setFromRotationMatrix (m: Matrix4, order: EulerOrder, result: Euler): Euler {
    const clamp = MathUtils.clamp;

    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    const te = m.getData();
    const m11 = te[0]; const m12 = te[4];
    const m13 = te[8];
    const m21 = te[1]; const m22 = te[5];
    const m23 = te[9];
    const m31 = te[2]; const m32 = te[6];
    const m33 = te[10];

    order = order || result._order;

    switch (order) {
      case EulerOrder.XYZ:

        result.y = Math.asin(clamp(m13, -1, 1));

        if (Math.abs(m13) < 0.9999999) {
          result.x = Math.atan2(-m23, m33);
          result.z = Math.atan2(-m12, m11);
        } else {
          result.x = Math.atan2(m32, m22);
          result.z = 0;
        }

        break;
      case EulerOrder.YXZ:

        result.x = Math.asin(-clamp(m23, -1, 1));

        if (Math.abs(m23) < 0.9999999) {
          result.y = Math.atan2(m13, m33);
          result.z = Math.atan2(m21, m22);
        } else {
          result.y = Math.atan2(-m31, m11);
          result.z = 0;
        }

        break;
      case EulerOrder.ZXY:

        result.x = Math.asin(clamp(m32, -1, 1));

        if (Math.abs(m32) < 0.9999999) {
          result.y = Math.atan2(-m31, m33);
          result.z = Math.atan2(-m12, m22);
        } else {
          result.y = 0;
          result.z = Math.atan2(m21, m11);
        }

        break;
      case EulerOrder.ZYX:

        result.y = Math.asin(-clamp(m31, -1, 1));

        if (Math.abs(m31) < 0.9999999) {
          result.x = Math.atan2(m32, m33);
          result.z = Math.atan2(m21, m11);
        } else {
          result.x = 0;
          result.z = Math.atan2(-m12, m22);
        }

        break;
      case EulerOrder.YZX:

        result.z = Math.asin(clamp(m21, -1, 1));

        if (Math.abs(m21) < 0.9999999) {
          result.x = Math.atan2(-m23, m22);
          result.y = Math.atan2(-m31, m11);
        } else {
          result.x = 0;
          result.y = Math.atan2(m13, m33);
        }

        break;
      case EulerOrder.XZY:

        result.z = Math.asin(-clamp(m12, -1, 1));

        if (Math.abs(m12) < 0.9999999) {
          result.x = Math.atan2(m32, m22);
          result.y = Math.atan2(m13, m11);
        } else {
          result.x = Math.atan2(-m23, m33);
          result.y = 0;
        }

        break;
      default:

        console.warn(`Euler.setFromRotationMatrix() encountered an unknown order: ${order}`);
    }

    result._order = order;

    return result;
  }

  /**
   * 通过四元数设置欧拉角
   * @param quat
   * @param order
   * @param result
   * @returns
   */
  static setFromQuaternion (quat: Quaternion, order: EulerOrder, result: Euler): Euler {
    const matrix = new Matrix4();

    quat.toMatrix4(matrix);

    return Euler.setFromRotationMatrix(matrix, order, result);
  }

  /**
   * 修改欧拉角顺序
   * @param euler
   * @param newOrder
   * @returns
   */
  static reorder (euler: Euler, newOrder: EulerOrder): Euler {
    const quat = new Quaternion();

    Quaternion.setFromEuler(euler, quat);

    return Euler.setFromQuaternion(quat, newOrder, euler);
  }
}

export { Euler, EulerOrder };
