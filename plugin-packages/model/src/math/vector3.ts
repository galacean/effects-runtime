import type { Quaternion } from './quaternion';
import type { Vec3DataType } from './type';
import { MathUtils } from './utilities/index';

class Vector3 {
  private _data: Float32Array;

  constructor (x?: number, y?: number, z?: number) {
    this._data = new Float32Array([x ?? 0.0, y ?? 0.0, z ?? 0.0]);
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

  set (x: number, y: number, z: number) {
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
  }

  get xyz (): [number, number, number] {
    return [
      this._data[0],
      this._data[1],
      this._data[2],
    ];
  }

  set xyz (data: [number, number, number]) {
    this._data[0] = data[0];
    this._data[1] = data[1];
    this._data[2] = data[2];
  }

  static fromElements (x: number, y: number, z: number) {
    const result = new Vector3(x, y, z);

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static clone (cartesian: Vector3 | Readonly<Vector3>) {
    return new Vector3(cartesian.x, cartesian.y, cartesian.z);
  }

  static pack (value: Vector3, array: Vec3DataType, startingIndex?: number) {
    startingIndex = (startingIndex ?? 0);

    array[startingIndex++] = value.x;
    array[startingIndex++] = value.y;
    array[startingIndex] = value.z;

    return array;
  }

  static unpack (array: Vec3DataType, startingIndex: number, result: Vector3) {
    result.x = array[startingIndex++];
    result.y = array[startingIndex++];
    result.z = array[startingIndex];

    return result;
  }

  static packArray (array: Vector3[], result: Vec3DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Vector3.pack(array[i], result, i * 3);
    }

    return result;
  }

  static unpackArray (array: Vec3DataType, result: Vector3[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 3) {
      const index = i / 3;

      result[index] = Vector3.unpack(array, i, result[index]);
    }

    return result;
  }

  /**
   *
   * @param array
   * @returns
   */
  static fromArray (array: Vec3DataType) {
    return this.unpack(array, 0, new Vector3());
  }

  static maximumComponent (cartesian: Vector3) {
    return Math.max(cartesian.x, cartesian.y, cartesian.z);
  }

  static minimumComponent (cartesian: Vector3) {
    return Math.min(cartesian.x, cartesian.y, cartesian.z);
  }

  static minComponentIndex (cartesian: Vector3) {
    if (cartesian.x < cartesian.y) {
      if (cartesian.x < cartesian.z) { return 0; } else { return 2; }
    } else {
      if (cartesian.y < cartesian.z) { return 1; } else { return 2; }
    }
  }

  static tryZUpVector (lookatDir: Vector3, result: Vector3) {
    const dir = lookatDir.clone().normalize();
    const dotList: number[] = [];
    const upList = [
      new Vector3(0, 1, 0),
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 1),
    ];

    upList.forEach(up => {
      dotList.push(Math.abs(dir.dot(up)));
    });

    if (dotList[0] < 0.99) {
      result.set(0, 1, 0);
    } else {
      let lastDot = 99999;

      dotList.forEach((dot, index) => {
        if (lastDot > dot) {
          result.copyFrom(upList[index]);
          lastDot = dot;
        }
      });
    }

    return result;
  }

  static computeUpVector (lookatDir: Vector3, result: Vector3) {
    const dir = lookatDir.clone().normalize();
    const minIndex = Vector3.minComponentIndex(Vector3.abs(dir, dir));

    if (minIndex !== 1) {
      result.set(0, 1, 0);
    } else {
      result.set(dir.z, 0, -dir.x);
      result.normalize();
    }

    return result;
  }

  static minimumByComponent (first: Vector3, second: Vector3, result: Vector3) {
    result.x = Math.min(first.x, second.x);
    result.y = Math.min(first.y, second.y);
    result.z = Math.min(first.z, second.z);

    return result;
  }

  static maximumByComponent (first: Vector3, second: Vector3, result: Vector3) {
    result.x = Math.max(first.x, second.x);
    result.y = Math.max(first.y, second.y);
    result.z = Math.max(first.z, second.z);

    return result;
  }

  static magnitudeSquared (cartesian: Vector3 | Readonly<Vector3>) {
    return (
      cartesian.x * cartesian.x +
      cartesian.y * cartesian.y +
      cartesian.z * cartesian.z
    );
  }

  static magnitude (cartesian: Vector3 | Readonly<Vector3>) {
    return Math.sqrt(Vector3.magnitudeSquared(cartesian));
  }

  static distance (left: Vector3, right: Vector3) {
    Vector3.subtract(left, right, distanceScratch);

    return Vector3.magnitude(distanceScratch);
  }

  static distanceSquared (left: Vector3, right: Vector3) {
    Vector3.subtract(left, right, distanceScratch);

    return Vector3.magnitudeSquared(distanceScratch);
  }

  static normalize (cartesian: Vector3 | Readonly<Vector3>, result: Vector3) {
    const magnitude = Vector3.magnitude(cartesian);

    if (magnitude > 1e-5) {
      result.x = cartesian.x / magnitude;
      result.y = cartesian.y / magnitude;
      result.z = cartesian.z / magnitude;
    } else {
      result.x = cartesian.x;
      result.y = cartesian.y;
      result.z = cartesian.z;
    }

    return result;
  }

  static dot (left: Vector3, right: Vector3) {
    return left.x * right.x + left.y * right.y + left.z * right.z;
  }

  static multiplyComponents (left: Vector3, right: Vector3, result: Vector3) {
    result.x = left.x * right.x;
    result.y = left.y * right.y;
    result.z = left.z * right.z;

    return result;
  }

  static divideComponents (left: Vector3, right: Vector3, result: Vector3) {
    result.x = left.x / right.x;
    result.y = left.y / right.y;
    result.z = left.z / right.z;

    return result;
  }

  static add (left: Vector3, right: Vector3, result: Vector3) {
    result.x = left.x + right.x;
    result.y = left.y + right.y;
    result.z = left.z + right.z;

    return result;
  }

  static subtract (left: Vector3, right: Vector3, result: Vector3) {
    result.x = left.x - right.x;
    result.y = left.y - right.y;
    result.z = left.z - right.z;

    return result;
  }

  static multiplyByScalar (cartesian: Vector3, scalar: number, result: Vector3) {
    result.x = cartesian.x * scalar;
    result.y = cartesian.y * scalar;
    result.z = cartesian.z * scalar;

    return result;
  }

  static divideByScalar (cartesian: Vector3, scalar: number, result: Vector3) {
    result.x = cartesian.x / scalar;
    result.y = cartesian.y / scalar;
    result.z = cartesian.z / scalar;

    return result;
  }

  static negate (cartesian: Vector3, result: Vector3) {
    result.x = -cartesian.x;
    result.y = -cartesian.y;
    result.z = -cartesian.z;

    return result;
  }

  static abs (cartesian: Vector3, result: Vector3) {
    result.x = Math.abs(cartesian.x);
    result.y = Math.abs(cartesian.y);
    result.z = Math.abs(cartesian.z);

    return result;
  }

  static clamp (target: Vector3, min: Vector3, max: Vector3) {
    Vector3.max(target, min, target);
    Vector3.min(target, max, target);

    return target;
  }

  static lerp (start: Vector3, end: Vector3, t: number, result: Vector3) {
    Vector3.multiplyByScalar(end, t, lerpScratch);
    result = Vector3.multiplyByScalar(start, 1.0 - t, result);

    return Vector3.add(lerpScratch, result, result);
  }

  static angleBetween (left: Vector3, right: Vector3) {
    Vector3.normalize(left, angleBetweenScratch);
    Vector3.normalize(right, angleBetweenScratch2);
    const cosine = Vector3.dot(angleBetweenScratch, angleBetweenScratch2);
    const sine = Vector3.magnitude(
      Vector3.cross(
        angleBetweenScratch,
        angleBetweenScratch2,
        angleBetweenScratch
      )
    );

    return Math.atan2(sine, cosine);
  }

  static mostOrthogonalAxis (cartesian: Vector3, result: Vector3) {
    const f = Vector3.normalize(cartesian, mostOrthogonalAxisScratch);

    Vector3.abs(f, f);

    if (f.x <= f.y) {
      if (f.x <= f.z) {
        Vector3.UNIT_X.copyTo(result);
      } else {
        Vector3.UNIT_Z.copyTo(result);
      }
    } else if (f.y <= f.z) {
      Vector3.UNIT_Y.copyTo(result);
    } else {
      Vector3.UNIT_Z.copyTo(result);
    }

    return result;
  }

  static projectVector (a: Vector3, b: Vector3, result: Vector3) {
    const scalar = Vector3.dot(a, b) / Vector3.dot(b, b);

    return Vector3.multiplyByScalar(b, scalar, result);
  }

  static equals (left: Vector3, right: Vector3) {
    return (
      left === right ||
      (left.x === right.x &&
        left.y === right.y &&
        left.z === right.z)
    );
  }

  static equalsArray (cartesian: Vector3, array: Vec3DataType, offset?: number) {
    offset = offset ?? 0;

    return (
      cartesian.x === array[offset] &&
      cartesian.y === array[offset + 1] &&
      cartesian.z === array[offset + 2]
    );
  }

  static equalsEpsilon (
    left: Vector3,
    right: Vector3,
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
        ))
    );
  }

  static cross (left: Vector3, right: Vector3, result?: Vector3) {
    const leftX = left.x;
    const leftY = left.y;
    const leftZ = left.z;
    const rightX = right.x;
    const rightY = right.y;
    const rightZ = right.z;

    const x = leftY * rightZ - leftZ * rightY;
    const y = leftZ * rightX - leftX * rightZ;
    const z = leftX * rightY - leftY * rightX;

    if (result === undefined) {
      result = new Vector3();
    }

    result.x = x;
    result.y = y;
    result.z = z;

    return result;
  }

  static midpoint (left: Vector3, right: Vector3, result: Vector3) {
    result.x = (left.x + right.x) * 0.5;
    result.y = (left.y + right.y) * 0.5;
    result.z = (left.z + right.z) * 0.5;

    return result;
  }

  /**
   * 计算两个向量各分量最小值
   * @param a
   * @param b
   * @returns
   */
  static min (a: Vector3, b: Vector3, result: Vector3) {
    Vector3.minimumByComponent(a, b, result);

    return result;
  }

  /**
   * 计算两个向量各分量最大值
   * @param a
   * @param b
   * @returns
   */
  static max (a: Vector3, b: Vector3, result: Vector3) {
    Vector3.maximumByComponent(a, b, result);

    return result;
  }

  /**
   * 混合两个向量
   * @param a
   * @param b
   * @param t
   * @returns
   */
  static mix (a: Vector3, b: Vector3, t: number, result: Vector3) {
    Vector3.lerp(a, b, t, result);

    return result;
  }

  static floor (a: Vector3, result: Vector3) {
    result.x = Math.floor(a.x);
    result.y = Math.floor(a.y);
    result.z = Math.floor(a.z);

    return result;
  }

  static ceil (a: Vector3, result: Vector3) {
    result.x = Math.ceil(a.x);
    result.y = Math.ceil(a.y);
    result.z = Math.ceil(a.z);

    return result;
  }

  static round (a: Vector3, result: Vector3) {
    result.x = Math.round(a.x);
    result.y = Math.round(a.y);
    result.z = Math.round(a.z);

    return result;
  }

  /**
   * 将三维向量数据拷贝给 result
   * @param result
   */
  copyTo (result: Vector3) {
    result.x = this.x;
    result.y = this.y;
    result.z = this.z;

    return result;
  }

  /**
   * 将三维向量数据从 source 拷贝回来
   * @param source
   */
  copyFrom (source: Vector3) {
    this.x = source.x;
    this.y = source.y;
    this.z = source.z;

    return this;
  }

  /**
   * 三维向量数据取 min
   * @param vec
   */
  min (vec: Vector3) {
    Vector3.min(this, vec, this);

    return this;
  }

  /**
   * 三维向量数据取 max
   * @param vec
   */
  max (vec: Vector3) {
    Vector3.max(this, vec, this);

    return this;
  }

  /**
   * 将三维向量数据从 clamp
   * @param min
   * @param max
   */
  clamp (min: Vector3, max: Vector3) {
    Vector3.clamp(this, min, max);

    return this;
  }

  /**
   * 将三维向量导出为 number[] 对象
   */
  toArray (): number[] {
    const array = new Array<number>(3);
    const result = Vector3.pack(this, array) as number[];

    return result;
  }

  /**
   * 使用向量数据克隆一个新的三维向量
   * @returns
   */
  clone () {
    const result = Vector3.clone(this);

    return result;
  }

  /**
   * 单位化三维向量，会直接修改原向量数据
   */
  normalize () {
    const result = Vector3.normalize(this, this);

    return result;
  }

  /**
   * 返回三维向量长度
   * @returns
   */
  length () {
    const result = Vector3.magnitude(this);

    return result;
  }

  sum () {
    return this.x + this.y + this.z;
  }

  /**
   * 返回向量长度的平方
   * @returns
   */
  lengthSquared () {
    const result = Vector3.magnitudeSquared(this);

    return result;
  }

  floor () {
    const result = Vector3.floor(this, this);

    return result;
  }

  ceil () {
    const result = Vector3.ceil(this, this);

    return result;
  }

  round () {
    const result = Vector3.round(this, this);

    return result;
  }

  negate () {
    const result = Vector3.negate(this, this);

    return result;
  }

  addScalar (value: number) {
    this.x += value;
    this.y += value;
    this.z += value;

    return this;
  }

  addVector (vector: Vector3) {
    const result = Vector3.add(this, vector, this);

    return this;
  }

  subScalar (value: number) {
    this.x -= value;
    this.y -= value;
    this.z -= value;

    return this;
  }

  subVector (vector: Vector3) {
    const result = Vector3.subtract(this, vector, this);

    return result;
  }

  multiplyScalar (value: number) {
    const result = Vector3.multiplyByScalar(this, value, this);

    return result;
  }

  multiplyVector (vector: Vector3) {
    const result = Vector3.multiplyComponents(this, vector, this);

    return result;
  }

  divideScalar (value: number) {
    const result = Vector3.divideByScalar(this, value, this);

    return result;
  }

  divideVector (vector: Vector3) {
    const result = Vector3.divideComponents(this, vector, this);

    return result;
  }

  dot (vector: Vector3) {
    const result = Vector3.dot(this, vector);

    return result;
  }

  cross (vector: Vector3) {
    const result = Vector3.cross(this, vector);

    return result;
  }

  distanceTo (v: Vector3) {
    const result = Vector3.distance(this, v);

    return result;
  }

  distanceSquaredTo (v: Vector3) {
    const result = Vector3.distanceSquared(this, v);

    return result;
  }

  angleTo (v: Vector3) {
    const result = Vector3.angleBetween(this, v);

    return result;
  }

  getData () {
    return this._data;
  }
  applyQuaternion (q: Quaternion, center: Vector3 = new Vector3()): this {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const { x: qx, y: qy, z: qz, w: qw } = q;
    const { x: centerX, y: centerY, z: centerZ } = center;

    const ix = qw * (x - centerX) + qy * (z - centerZ) - qz * (y - centerY);
    const iy = qw * (y - centerY) + qz * (x - centerX) - qx * (z - centerZ);
    const iz = qw * (z - centerZ) + qx * (y - centerY) - qy * (x - centerX);
    const iw = - qx * (x - centerX) - qy * (y - centerY) - qz * (z - centerZ);

    this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy + centerX;
    this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz + centerY;
    this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx + centerZ;

    return this;
  }

  static ZERO = Object.freeze(new Vector3(0.0, 0.0, 0.0));

  static ONE = Object.freeze(new Vector3(1.0, 1.0, 1.0));

  static UNIT_X = Object.freeze(new Vector3(1.0, 0.0, 0.0));

  static UNIT_Y = Object.freeze(new Vector3(0.0, 1.0, 0.0));

  static UNIT_Z = Object.freeze(new Vector3(0.0, 0.0, 1.0));
}

const distanceScratch = new Vector3();

const lerpScratch = new Vector3();

const angleBetweenScratch = new Vector3();

const angleBetweenScratch2 = new Vector3();

const mostOrthogonalAxisScratch = new Vector3();

export { Vector3 };
