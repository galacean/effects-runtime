import { Matrix4 } from './matrix4';
import { Matrix3 } from './matrix3';
import type { Vec4DataType } from './type';
import { Vector3 } from './vector3';
import type { Euler } from './euler';
import { EulerOrder } from './euler';
import { MathUtils } from './utilities';

/**
 * 使用四元数表示一个旋转
 */
class Quaternion {
  private _data: Float32Array;

  constructor (x?: number, y?: number, z?: number, w?: number) {
    this._data = new Float32Array([x ?? 0.0, y ?? 0.0, z ?? 0.0, w ?? 0.0]);
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

  get w () {
    return this._data[3];
  }
  set w (value: number) {
    this._data[3] = value;
  }

  getW () {
    return this._data[3];
  }

  setW (value: number) {
    this._data[3] = value;
  }

  /**
   * 构造一个四元素表示绕 axis 轴旋转 angle 角度
   * @param axis
   * @param angle
   * @param result
   * @returns
   */
  static fromAxisAngle (axis: Vector3 | Readonly<Vector3>, angle: number, result: Quaternion) {
    const halfAngle = angle / 2.0;
    const s = Math.sin(halfAngle);

    fromAxisAngleScratch = Vector3.normalize(axis, fromAxisAngleScratch);

    const x = fromAxisAngleScratch.x * s;
    const y = fromAxisAngleScratch.y * s;
    const z = fromAxisAngleScratch.z * s;
    const w = Math.cos(halfAngle);

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  /**
   * 从旋转矩阵构造一个四元数
   * @param matrix
   * @param result
   * @returns
   */
  static fromRotationMatrix (matrix: Matrix3, result: Quaternion) {
    let root;
    let x;
    let y;
    let z;
    let w;

    const m00 = matrix.getData()[Matrix3.COLUMN0ROW0];
    const m11 = matrix.getData()[Matrix3.COLUMN1ROW1];
    const m22 = matrix.getData()[Matrix3.COLUMN2ROW2];
    const trace = m00 + m11 + m22;

    if (trace > 0.0) {
      // |w| > 1/2, may as well choose w > 1/2
      root = Math.sqrt(trace + 1.0); // 2w
      w = 0.5 * root;
      root = 0.5 / root; // 1/(4w)

      x = (matrix.getData()[Matrix3.COLUMN1ROW2] - matrix.getData()[Matrix3.COLUMN2ROW1]) * root;
      y = (matrix.getData()[Matrix3.COLUMN2ROW0] - matrix.getData()[Matrix3.COLUMN0ROW2]) * root;
      z = (matrix.getData()[Matrix3.COLUMN0ROW1] - matrix.getData()[Matrix3.COLUMN1ROW0]) * root;
    } else {
      // |w| <= 1/2
      const next = fromRotationMatrixNext;

      let i = 0;

      if (m11 > m00) {
        i = 1;
      }
      if (m22 > m00 && m22 > m11) {
        i = 2;
      }
      const j = next[i];
      const k = next[j];

      root = Math.sqrt(
        matrix.getData()[Matrix3.getElementIndex(i, i)] -
        matrix.getData()[Matrix3.getElementIndex(j, j)] -
        matrix.getData()[Matrix3.getElementIndex(k, k)] +
        1.0
      );

      const quat = fromRotationMatrixQuat;

      quat[i] = 0.5 * root;
      root = 0.5 / root;
      w =
        (matrix.getData()[Matrix3.getElementIndex(k, j)] -
          matrix.getData()[Matrix3.getElementIndex(j, k)]) *
        root;
      quat[j] =
        (matrix.getData()[Matrix3.getElementIndex(j, i)] +
          matrix.getData()[Matrix3.getElementIndex(i, j)]) *
        root;
      quat[k] =
        (matrix.getData()[Matrix3.getElementIndex(k, i)] +
          matrix.getData()[Matrix3.getElementIndex(i, k)]) *
        root;

      x = -quat[0];
      y = -quat[1];
      z = -quat[2];
    }

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  /**
   * 从相机 heading、pitch、roll 构造一个四元数。heading 表示绕 z 轴旋转角度、pitch 表示绕 y 轴旋转角度、roll 表示绕 x 轴旋转角度
   * @param headingPitchRoll
   * @param result
   * @returns
   */
  static fromHeadingPitchRoll (headingPitchRoll: { heading: number, pitch: number, roll: number }, result: Quaternion) {
    scratchRollQuaternion = Quaternion.fromAxisAngle(
      Vector3.UNIT_X,
      headingPitchRoll.roll,
      scratchHPRQuaternion
    );
    scratchPitchQuaternion = Quaternion.fromAxisAngle(
      Vector3.UNIT_Y,
      -headingPitchRoll.pitch,
      result
    );
    result = Quaternion.multiply(
      scratchPitchQuaternion,
      scratchRollQuaternion,
      scratchPitchQuaternion
    );
    scratchHeadingQuaternion = Quaternion.fromAxisAngle(
      Vector3.UNIT_Z,
      -headingPitchRoll.heading,
      scratchHPRQuaternion
    );

    return Quaternion.multiply(scratchHeadingQuaternion, result, result);
  }

  /**
   * 将欧拉角转成四元数
   * @param euler
   * @param result
   * @returns
   */
  static setFromEuler (euler: Euler, result: Quaternion) {
    const x = euler.x;
    const y = euler.y;
    const z = euler.z;
    const order = euler.order;

    const cos = Math.cos;
    const sin = Math.sin;

    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);

    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);

    switch (order) {
      case EulerOrder.XYZ:
        result.x = s1 * c2 * c3 + c1 * s2 * s3;
        result.y = c1 * s2 * c3 - s1 * c2 * s3;
        result.z = c1 * c2 * s3 + s1 * s2 * c3;
        result.w = c1 * c2 * c3 - s1 * s2 * s3;

        break;
      case EulerOrder.YXZ:
        result.x = s1 * c2 * c3 + c1 * s2 * s3;
        result.y = c1 * s2 * c3 - s1 * c2 * s3;
        result.z = c1 * c2 * s3 - s1 * s2 * c3;
        result.w = c1 * c2 * c3 + s1 * s2 * s3;

        break;
      case EulerOrder.ZXY:
        result.x = s1 * c2 * c3 - c1 * s2 * s3;
        result.y = c1 * s2 * c3 + s1 * c2 * s3;
        result.z = c1 * c2 * s3 + s1 * s2 * c3;
        result.w = c1 * c2 * c3 - s1 * s2 * s3;

        break;
      case EulerOrder.ZYX:
        result.x = s1 * c2 * c3 - c1 * s2 * s3;
        result.y = c1 * s2 * c3 + s1 * c2 * s3;
        result.z = c1 * c2 * s3 - s1 * s2 * c3;
        result.w = c1 * c2 * c3 + s1 * s2 * s3;

        break;
      case EulerOrder.YZX:
        result.x = s1 * c2 * c3 + c1 * s2 * s3;
        result.y = c1 * s2 * c3 + s1 * c2 * s3;
        result.z = c1 * c2 * s3 - s1 * s2 * c3;
        result.w = c1 * c2 * c3 - s1 * s2 * s3;

        break;
      case EulerOrder.XZY:
        result.x = s1 * c2 * c3 - c1 * s2 * s3;
        result.y = c1 * s2 * c3 - s1 * c2 * s3;
        result.z = c1 * c2 * s3 + s1 * s2 * c3;
        result.w = c1 * c2 * c3 + s1 * s2 * s3;

        break;
      default:
        console.warn(`Quaternion.setFromEuler() encountered an unknown order: ${order}`);
    }

    return result;
  }

  /**
   * 四元数打包成数组
   * @param value
   * @param array
   * @param startingIndex
   * @returns
   */
  static pack (value: Quaternion, array: Vec4DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    array[startingIndex++] = value.x;
    array[startingIndex++] = value.y;
    array[startingIndex++] = value.z;
    array[startingIndex] = value.w;

    return array;
  }

  /**
   * 从数组中解包四元数
   * @param array
   * @param startingIndex
   * @param result
   * @returns
   */
  static unpack (array: Vec4DataType, startingIndex: number, result: Quaternion) {
    result.x = array[startingIndex++];
    result.y = array[startingIndex++];
    result.z = array[startingIndex++];
    result.w = array[startingIndex];

    return result;
  }

  /**
   * 从数组构造一个四元数
   * @param array
   * @param startingIndex
   * @param result
   * @returns
   */
  static fromArray (array: Vec4DataType) {
    return Quaternion.unpack(array, 0, new Quaternion());
  }

  /**
   * 两个四元数相乘
   * @param left
   * @param right
   * @param result
   * @returns
   */
  static multiply (left: Quaternion, right: Quaternion, result: Quaternion) {
    const leftX = left.x;
    const leftY = left.y;
    const leftZ = left.z;
    const leftW = left.w;

    const rightX = right.x;
    const rightY = right.y;
    const rightZ = right.z;
    const rightW = right.w;

    const x = leftW * rightX + leftX * rightW + leftY * rightZ - leftZ * rightY;
    const y = leftW * rightY - leftX * rightZ + leftY * rightW + leftZ * rightX;
    const z = leftW * rightZ + leftX * rightY - leftY * rightX + leftZ * rightW;
    const w = leftW * rightW - leftX * rightX - leftY * rightY - leftZ * rightZ;

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  /**
   * 从输入四元数克隆一个四元数
   * @param quaternion
   * @param result
   * @returns
   */
  static clone (quaternion: Quaternion | Readonly<Quaternion>) {
    const result = new Quaternion();

    result.x = quaternion.x;
    result.y = quaternion.y;
    result.z = quaternion.z;
    result.w = quaternion.w;

    return result;
  }

  static copyTo (quaternion: Quaternion | Readonly<Quaternion>, result: Quaternion) {
    result.x = quaternion.x;
    result.y = quaternion.y;
    result.z = quaternion.z;
    result.w = quaternion.w;

    return result;
  }

  /**
   * 四元数的共轭
   * @param quaternion
   * @param result
   * @returns
   */
  static conjugate (quaternion: Quaternion, result: Quaternion) {
    result.x = -quaternion.x;
    result.y = -quaternion.y;
    result.z = -quaternion.z;
    result.w = quaternion.w;

    return result;
  }

  /**
   * 四元数的模的平方
   * @param quaternion
   * @returns
   */
  static magnitudeSquared (quaternion: Quaternion) {
    return (
      quaternion.x * quaternion.x +
      quaternion.y * quaternion.y +
      quaternion.z * quaternion.z +
      quaternion.w * quaternion.w
    );
  }

  /**
   * 四元数的模
   * @param quaternion
   * @returns
   */
  static magnitude (quaternion: Quaternion) {
    return Math.sqrt(Quaternion.magnitudeSquared(quaternion));
  }

  /**
   * 单位化四元数
   * @param quaternion
   * @param result
   * @returns
   */
  static normalize (quaternion: Quaternion, result: Quaternion) {
    const inverseMagnitude = 1.0 / Quaternion.magnitude(quaternion);
    const x = quaternion.x * inverseMagnitude;
    const y = quaternion.y * inverseMagnitude;
    const z = quaternion.z * inverseMagnitude;
    const w = quaternion.w * inverseMagnitude;

    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  /**
   * 四元数求逆
   * @param quaternion
   * @param result
   * @returns
   */
  static inverse (quaternion: Quaternion, result: Quaternion) {
    const magnitudeSquared = Quaternion.magnitudeSquared(quaternion);

    result = Quaternion.conjugate(quaternion, result);

    return Quaternion.multiplyByScalar(result, 1.0 / magnitudeSquared, result);
  }

  static add (left: Quaternion, right: Quaternion, result: Quaternion) {
    result.x = left.x + right.x;
    result.y = left.y + right.y;
    result.z = left.z + right.z;
    result.w = left.w + right.w;

    return result;
  }

  static subtract (left: Quaternion, right: Quaternion, result: Quaternion) {
    result.x = left.x - right.x;
    result.y = left.y - right.y;
    result.z = left.z - right.z;
    result.w = left.w - right.w;

    return result;
  }

  static negate (quaternion: Quaternion, result: Quaternion) {
    result.x = -quaternion.x;
    result.y = -quaternion.y;
    result.z = -quaternion.z;
    result.w = -quaternion.w;

    return result;
  }

  static dot (left: Quaternion, right: Quaternion) {
    return (
      left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w
    );
  }

  static multiplyByScalar (quaternion: Quaternion, scalar: number, result: Quaternion) {
    result.x = quaternion.x * scalar;
    result.y = quaternion.y * scalar;
    result.z = quaternion.z * scalar;
    result.w = quaternion.w * scalar;

    return result;
  }

  static computeAxis (quaternion: Quaternion, result: Vector3) {
    const w = quaternion.w;

    if (Math.abs(w - 1.0) < MathUtils.EPSILON6) {
      result.x = result.y = result.z = 0;

      return result;
    }

    const scalar = 1.0 / Math.sqrt(1.0 - w * w);

    result.x = quaternion.x * scalar;
    result.y = quaternion.y * scalar;
    result.z = quaternion.z * scalar;

    return result;
  }

  /**
   * 计算旋转角度
   * @param quaternion
   * @returns
   */
  static computeAngle (quaternion: Quaternion) {
    if (Math.abs(quaternion.w - 1.0) < MathUtils.EPSILON6) {
      return 0.0;
    }

    return 2.0 * Math.acos(quaternion.w);
  }

  /**
   * 线性插值
   * @param start
   * @param end
   * @param t
   * @param result
   * @returns
   */
  static lerp (start: Quaternion, end: Quaternion, t: number, result: Quaternion) {
    lerpScratch = Quaternion.multiplyByScalar(end, t, lerpScratch);
    result = Quaternion.multiplyByScalar(start, 1.0 - t, result);

    return Quaternion.add(lerpScratch, result, result);
  }

  /**
   * 球面线性插值
   * @param start
   * @param end
   * @param t
   * @param result
   * @returns
   */
  static slerp (start: Quaternion, end: Quaternion, t: number, result: Quaternion) {
    let dot = Quaternion.dot(start, end);
    // The angle between start must be acute. Since q and -q represent
    // the same rotation, negate q to get the acute angle.
    let r = end;

    if (dot < 0.0) {
      dot = -dot;
      r = slerpEndNegated = Quaternion.negate(end, slerpEndNegated);
    }

    // dot > 0, as the dot product approaches 1, the angle between the
    // quaternions vanishes. use linear interpolation.
    if (1.0 - dot < MathUtils.EPSILON6) {
      return Quaternion.lerp(start, r, t, result);
    }

    const theta = Math.acos(dot);

    slerpScaledP = Quaternion.multiplyByScalar(
      start,
      Math.sin((1 - t) * theta),
      slerpScaledP
    );
    slerpScaledR = Quaternion.multiplyByScalar(
      r,
      Math.sin(t * theta),
      slerpScaledR
    );
    result = Quaternion.add(slerpScaledP, slerpScaledR, result);

    return Quaternion.multiplyByScalar(result, 1.0 / Math.sin(theta), result);
  }

  static equals (left: Quaternion, right: Quaternion) {
    return (
      left === right ||
      (
        left.x === right.x &&
        left.y === right.y &&
        left.z === right.z &&
        left.w === right.w)
    );
  }

  static equalsEpsilon (left: Quaternion, right: Quaternion, epsilon?: number) {
    epsilon = (epsilon ?? 0);

    return (
      left === right ||
      (
        Math.abs(left.x - right.x) <= epsilon &&
        Math.abs(left.y - right.y) <= epsilon &&
        Math.abs(left.z - right.z) <= epsilon &&
        Math.abs(left.w - right.w) <= epsilon)
    );
  }

  /**
   * 将四元数转变为一个 4x4 矩阵
   * @param result
   * @returns
   */
  toMatrix4 (result: Matrix4) {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const w = this.w;

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

    result = Matrix4.fromColumnMajorArray([
      1 - (yy + zz),
      xy + wz,
      xz - wy,
      0,

      xy - wz,
      1 - (xx + zz),
      yz + wx,
      0,

      xz + wy,
      yz - wx,
      1 - (xx + yy),
      0,

      0,
      0,
      0,
      1,
    ], result);

    return result;
  }

  /**
   * 使用四元数内部数据克隆出一个新的四元数
   * @returns
   */
  clone () {
    const result = Quaternion.clone(this);

    return result;
  }

  /**
   * 将四元数数据拷贝给 result
   * @param result
   */
  copyTo (result: Quaternion) {
    result = Quaternion.copyTo(this, result);

    return result;
  }

  /**
   * 将四元数数据从 source 拷贝回来
   * @param source
   */
  copyFrom (source: Quaternion) {
    Quaternion.copyTo(source, this);

    return this;
  }

  /**
   * 绕 x 轴旋转角度分量
   * @returns
   */
  roll (): number {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const w = this.w;

    return Math.atan2(2.0 * (x * y + w * z), w * w + x * x - y * y - z * z);
  }

  /**
   * 绕 y 轴旋转分量
   * @returns
   */
  pitch (): number {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const w = this.w;

    return Math.atan2(2.0 * (y * z + w * x), w * w - x * x - y * y + z * z);
  }

  /**
   * 绕 z 轴旋转分量
   * @returns
   */
  yaw (): number {
    return Math.asin(2.0 * (this.x * this.z - this.w * this.y));
  }

  inverse (): Quaternion {
    const result = Quaternion.inverse(this, this);

    return result;
  }

  conjugate (): Quaternion {
    const result = Quaternion.conjugate(this, this);

    return result;
  }

  length (): number {
    const result = Quaternion.magnitude(this);

    return result;
  }

  normalize (): Quaternion {
    const result = Quaternion.normalize(this, this);

    return result;
  }

  add (other: Quaternion): Quaternion {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    this.w += other.w;

    return this;
  }

  multiply (other: Quaternion): Quaternion {
    const result = Quaternion.multiply(this, other, this);

    return result;
  }

  set (x: number, y: number, z: number, w: number): Quaternion {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;

    return this;
  }

  setFromEuler (euler: Euler): Quaternion {
    const result = Quaternion.setFromEuler(euler, this);

    return result;
  }

  toArray () {
    const result = [
      this._data[0],
      this._data[1],
      this._data[2],
      this._data[3],
    ];

    return result;
  }

  static IDENTITY = Object.freeze(new Quaternion(0.0, 0.0, 0.0, 1.0));

  static ZERO = Object.freeze(new Quaternion(0.0, 0.0, 0.0, 0.0));
}

let fromAxisAngleScratch = new Vector3();

const fromRotationMatrixNext = [1, 2, 0];

const fromRotationMatrixQuat = new Array(3);

const scratchHPRQuaternion = new Quaternion();
let scratchHeadingQuaternion = new Quaternion();
let scratchPitchQuaternion = new Quaternion();
let scratchRollQuaternion = new Quaternion();

const sampledQuaternionAxis = new Vector3();
const sampledQuaternionRotation = new Vector3();
const sampledQuaternionTempQuaternion = new Quaternion();
const sampledQuaternionQuaternion0 = new Quaternion();
const sampledQuaternionQuaternion0Conjugate = new Quaternion();

let lerpScratch = new Quaternion();

let slerpEndNegated = new Quaternion();
let slerpScaledP = new Quaternion();
let slerpScaledR = new Quaternion();

export { Quaternion };
