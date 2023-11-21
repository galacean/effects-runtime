import type { Vec4DataType } from './type';
import { MathUtils } from './utilities/index';

/**
 * 四维向量
 */
class Vector4 {
  private _data: Float32Array;

  constructor (x?: number, y?: number, z?: number, w?: number) {
    this._data = new Float32Array([x ?? 0.0, y ?? 0.0, z ?? 0.0, w ?? 1.0]);
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

  set (x: number, y: number, z: number, w: number) {
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    this._data[3] = w;
  }

  static fromElements (x: number, y: number, z: number, w: number, result?: Vector4) {
    if (result == undefined) {
      return new Vector4(x, y, z, w);
    }
    result.x = x;
    result.y = y;
    result.z = z;
    result.w = w;

    return result;
  }

  static clone (cartesian: Vector4 | Readonly<Vector4>) {
    return new Vector4(cartesian.x, cartesian.y, cartesian.z, cartesian.w);
  }

  // Cartesian4.packedLength = 4;

  static pack (value: Vector4, array: Vec4DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    array[startingIndex++] = value.x;
    array[startingIndex++] = value.y;
    array[startingIndex++] = value.z;
    array[startingIndex] = value.w;

    return array;
  }

  static unpack (array: Vec4DataType, startingIndex: number, result: Vector4) {
    result.x = array[startingIndex++];
    result.y = array[startingIndex++];
    result.z = array[startingIndex++];
    result.w = array[startingIndex];

    return result;
  }

  static packArray (array: Vector4[], result: Vec4DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Vector4.pack(array[i], result, i * 4);
    }

    return result;
  }

  static unpackArray (array: Vec4DataType, result: Vector4[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 4) {
      const index = i / 4;

      result[index] = Vector4.unpack(array, i, result[index]);
    }

    return result;
  }

  static fromArray (array: Vec4DataType) {
    return Vector4.unpack(array, 0, new Vector4());
  }

  static maximumComponent (cartesian: Vector4) {
    return Math.max(cartesian.x, cartesian.y, cartesian.z, cartesian.w);
  }

  static minimumComponent (cartesian: Vector4) {
    return Math.min(cartesian.x, cartesian.y, cartesian.z, cartesian.w);
  }

  static minimumByComponent (first: Vector4, second: Vector4, result: Vector4) {
    result.x = Math.min(first.x, second.x);
    result.y = Math.min(first.y, second.y);
    result.z = Math.min(first.z, second.z);
    result.w = Math.min(first.w, second.w);

    return result;
  }

  static maximumByComponent (first: Vector4, second: Vector4, result: Vector4) {
    result.x = Math.max(first.x, second.x);
    result.y = Math.max(first.y, second.y);
    result.z = Math.max(first.z, second.z);
    result.w = Math.max(first.w, second.w);

    return result;
  }

  static magnitudeSquared (cartesian: Vector4) {
    return (
      cartesian.x * cartesian.x +
      cartesian.y * cartesian.y +
      cartesian.z * cartesian.z +
      cartesian.w * cartesian.w
    );
  }

  static magnitude (cartesian: Vector4) {
    return Math.sqrt(Vector4.magnitudeSquared(cartesian));
  }

  static distance (left: Vector4, right: Vector4) {
    Vector4.subtract(left, right, distanceScratch);

    return Vector4.magnitude(distanceScratch);
  }

  static distanceSquared (left: Vector4, right: Vector4) {
    Vector4.subtract(left, right, distanceScratch);

    return Vector4.magnitudeSquared(distanceScratch);
  }

  static normalize (cartesian: Vector4, result: Vector4) {
    const magnitude = Vector4.magnitude(cartesian);

    result.x = cartesian.x / magnitude;
    result.y = cartesian.y / magnitude;
    result.z = cartesian.z / magnitude;
    result.w = cartesian.w / magnitude;

    return result;
  }

  static dot (left: Vector4, right: Vector4) {
    return (
      left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w
    );
  }

  static multiplyComponents (left: Vector4, right: Vector4, result: Vector4) {
    result.x = left.x * right.x;
    result.y = left.y * right.y;
    result.z = left.z * right.z;
    result.w = left.w * right.w;

    return result;
  }

  static divideComponents (left: Vector4, right: Vector4, result: Vector4) {
    result.x = left.x / right.x;
    result.y = left.y / right.y;
    result.z = left.z / right.z;
    result.w = left.w / right.w;

    return result;
  }

  static add (left: Vector4, right: Vector4, result: Vector4) {
    result.x = left.x + right.x;
    result.y = left.y + right.y;
    result.z = left.z + right.z;
    result.w = left.w + right.w;

    return result;
  }

  static subtract (left: Vector4, right: Vector4, result: Vector4) {
    result.x = left.x - right.x;
    result.y = left.y - right.y;
    result.z = left.z - right.z;
    result.w = left.w - right.w;

    return result;
  }

  static multiplyByScalar (cartesian: Vector4, scalar: number, result: Vector4) {
    result.x = cartesian.x * scalar;
    result.y = cartesian.y * scalar;
    result.z = cartesian.z * scalar;
    result.w = cartesian.w * scalar;

    return result;
  }

  static divideByScalar (cartesian: Vector4, scalar: number, result: Vector4) {
    result.x = cartesian.x / scalar;
    result.y = cartesian.y / scalar;
    result.z = cartesian.z / scalar;
    result.w = cartesian.w / scalar;

    return result;
  }

  static negate (cartesian: Vector4, result: Vector4) {
    result.x = -cartesian.x;
    result.y = -cartesian.y;
    result.z = -cartesian.z;
    result.w = -cartesian.w;

    return result;
  }

  static abs (cartesian: Vector4, result: Vector4) {
    result.x = Math.abs(cartesian.x);
    result.y = Math.abs(cartesian.y);
    result.z = Math.abs(cartesian.z);
    result.w = Math.abs(cartesian.w);

    return result;
  }

  static lerp (start: Vector4, end: Vector4, t: number, result: Vector4) {
    Vector4.multiplyByScalar(end, t, lerpScratch);
    result = Vector4.multiplyByScalar(start, 1.0 - t, result);

    return Vector4.add(lerpScratch, result, result);
  }

  static mostOrthogonalAxis (cartesian: Vector4, result: Vector4) {
    const f = Vector4.normalize(cartesian, mostOrthogonalAxisScratch);

    Vector4.abs(f, f);

    if (f.x <= f.y) {
      if (f.x <= f.z) {
        if (f.x <= f.w) {
          Vector4.UNIT_X.copyTo(result);
        } else {
          Vector4.UNIT_W.copyTo(result);
        }
      } else if (f.z <= f.w) {
        Vector4.UNIT_Z.copyTo(result);
      } else {
        Vector4.UNIT_W.copyTo(result);
      }
    } else if (f.y <= f.z) {
      if (f.y <= f.w) {
        Vector4.UNIT_Y.copyTo(result);
      } else {
        Vector4.UNIT_W.copyTo(result);
      }
    } else if (f.z <= f.w) {
      Vector4.UNIT_Z.copyTo(result);
    } else {
      Vector4.UNIT_W.copyTo(result);
    }

    return result;
  }

  static equals (left: Vector4, right: Vector4) {
    return (
      left === right ||
      (
        left.x === right.x &&
        left.y === right.y &&
        left.z === right.z &&
        left.w === right.w)
    );
  }

  static equalsArray (cartesian: Vector4, array: Vec4DataType, offset?: number) {
    offset = offset ?? 0;

    return (
      cartesian.x === array[offset] &&
      cartesian.y === array[offset + 1] &&
      cartesian.z === array[offset + 2] &&
      cartesian.w === array[offset + 3]
    );
  }

  static equalsEpsilon (
    left: Vector4,
    right: Vector4,
    relativeEpsilon: number,
    absoluteEpsilon: number
  ) {
    return (
      left === right ||
      (
        MathUtils.equalsEpsilon(
          left.x,
          right.x,
          relativeEpsilon,
          absoluteEpsilon
        ) &&
        MathUtils.equalsEpsilon(
          left.y,
          right.y,
          relativeEpsilon,
          absoluteEpsilon
        ) &&
        MathUtils.equalsEpsilon(
          left.z,
          right.z,
          relativeEpsilon,
          absoluteEpsilon
        ) &&
        MathUtils.equalsEpsilon(
          left.w,
          right.w,
          relativeEpsilon,
          absoluteEpsilon
        ))
    );
  }

  /**
   * 将四维向量导出为 number[] 对象
   * @returns
   */
  toArray (): number[] {
    const array = new Array<number>(4);
    const result = Vector4.pack(this, array) as number[];

    return result;
  }

  /**
   * 计算两个向量各分量最小值
   * @param a
   * @param b
   * @returns
   */
  static min (a: Vector4, b: Vector4, result: Vector4) {
    Vector4.minimumByComponent(a, b, result);

    return result;
  }

  /**
   * 计算两个向量各分量最大值
   * @param a
   * @param b
   * @returns
   */
  static max (a: Vector4, b: Vector4, result: Vector4) {
    Vector4.maximumByComponent(a, b, result);

    return result;
  }

  /**
   * 混合两个向量
   * @param a
   * @param b
   * @param t
   * @returns
   */
  static mix (a: Vector4, b: Vector4, t: number, result: Vector4) {
    Vector4.lerp(a, b, t, result);

    return result;
  }

  static floor (a: Vector4, result: Vector4) {
    result.x = Math.floor(a.x);
    result.y = Math.floor(a.y);
    result.z = Math.floor(a.z);
    result.w = Math.floor(a.w);

    return result;
  }

  static ceil (a: Vector4, result: Vector4) {
    result.x = Math.ceil(a.x);
    result.y = Math.ceil(a.y);
    result.z = Math.ceil(a.z);
    result.w = Math.ceil(a.w);

    return result;
  }

  static round (a: Vector4, result: Vector4) {
    result.x = Math.round(a.x);
    result.y = Math.round(a.y);
    result.z = Math.round(a.z);
    result.w = Math.round(a.w);

    return result;
  }

  /**
   * 将三维向量数据拷贝给 result
   * @param result
   */
  copyTo (result: Vector4) {
    result.x = this.x;
    result.y = this.y;
    result.z = this.z;
    result.w = this.w;

    return result;
  }

  /**
   * 使用向量数据克隆一个新的四维向量
   * @returns
   */
  clone () {
    const result = Vector4.clone(this);

    return result;
  }

  /**
   * 单位化三维向量，会直接修改原向量数据
   */
  normalize () {
    const result = Vector4.normalize(this, this);

    return result;
  }

  /**
   * 返回三维向量长度
   * @returns
   */
  length () {
    const result = Vector4.magnitude(this);

    return result;
  }

  /**
   * 返回向量长度的平方
   * @returns
   */
  lengthSquared () {
    const result = Vector4.magnitudeSquared(this);

    return result;
  }

  floor () {
    const result = Vector4.floor(this, this);

    return result;
  }

  ceil () {
    const result = Vector4.ceil(this, this);

    return result;
  }

  round () {
    const result = Vector4.round(this, this);

    return result;
  }

  negate () {
    const result = Vector4.negate(this, this);

    return result;
  }

  addScalar (value: number) {
    this.x += value;
    this.y += value;
    this.z += value;
    this.w += value;

    return this;
  }

  addVector (vector: Vector4) {
    const result = Vector4.add(this, vector, this);

    return result;
  }

  subScalar (value: number) {
    this.x -= value;
    this.y -= value;
    this.z -= value;
    this.w -= value;

    return this;
  }

  subVector (vector: Vector4) {
    const result = Vector4.subtract(this, vector, this);

    return result;
  }

  multiplyScalar (value: number) {
    const result = Vector4.multiplyByScalar(this, value, this);

    return result;
  }

  multiplyVector (vector: Vector4) {
    const result = Vector4.multiplyComponents(this, vector, this);

    return result;
  }

  divideScalar (value: number) {
    const result = Vector4.divideByScalar(this, value, this);

    return result;
  }

  divideVector (vector: Vector4) {
    const result = Vector4.divideComponents(this, vector, this);

    return result;
  }

  dot (vector: Vector4) {
    const result = Vector4.dot(this, vector);

    return result;
  }

  distanceTo (v: Vector4) {
    const result = Vector4.distance(this, v);

    return result;
  }

  distanceSquaredTo (v: Vector4) {
    const result = Vector4.distanceSquared(this, v);

    return result;
  }

  getData () {
    return this._data;
  }

  static ZERO = Object.freeze(new Vector4(0.0, 0.0, 0.0, 0.0));

  static ONE = Object.freeze(new Vector4(1.0, 1.0, 1.0, 1.0));

  static UNIT_X = Object.freeze(new Vector4(1.0, 0.0, 0.0, 0.0));

  static UNIT_Y = Object.freeze(new Vector4(0.0, 1.0, 0.0, 0.0));

  static UNIT_Z = Object.freeze(new Vector4(0.0, 0.0, 1.0, 0.0));

  static UNIT_W = Object.freeze(new Vector4(0.0, 0.0, 0.0, 1.0));
}

const distanceScratch = new Vector4();

const lerpScratch = new Vector4();

const mostOrthogonalAxisScratch = new Vector4();

export { Vector4 };
