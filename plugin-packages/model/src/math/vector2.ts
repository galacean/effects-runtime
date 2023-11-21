import type { Vec2DataType } from './type';
import { MathUtils } from './utilities/index';

/**
 * 表示二维向量/二维点，内部使用 Float32Array 保存数据。
 */
class Vector2 {
  private _data: Float32Array;

  constructor (x?: number, y?: number) {
    this._data = new Float32Array([x ?? 0.0, y ?? 0.0]);
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

  set (x: number, y: number) {
    this._data[0] = x;
    this._data[1] = y;
  }

  get xy (): [number, number] {
    return [this._data[0], this._data[1]];
  }

  set xy (data: [number, number]) {
    this._data[0] = data[0];
    this._data[1] = data[1];
  }

  /**
   *
   * @param x
   * @param y
   * @returns
   */
  static fromElements (x: number, y: number) {
    const result = new Vector2(x, y);

    result.x = x;
    result.y = y;

    return result;
  }

  /**
   *
   * @param cartesian
   * @returns
   */
  static clone (cartesian: Vector2 | Readonly<Vector2>) {
    const result = new Vector2(cartesian.x, cartesian.y);

    return result;
  }

  /**
   * 将二维向量打包到数组对象中。
   * @param value - 待打包的二维向量。
   * @param array - 保存打包向量数据。
   * @param startingIndex - 保存数据数组元素起始索引，默认在数组起始位置保存数据。
   * @returns 返回打包好的二维数据。
   */
  static pack (value: Vector2 | Readonly<Vector2>, array: Vec2DataType, startingIndex?: number) {
    startingIndex = startingIndex ?? 0;

    array[startingIndex++] = value.x;
    array[startingIndex] = value.y;

    return array;
  }

  /**
   * 从数组中解包二维向量
   * @param array - 待解包的数组
   * @param startingIndex - 从数组第几个位置开始解包二维向量
   * @param result - 保存解包后的二维向量
   * @returns 返回解包后的二维向量
   */
  static unpack (array: Vec2DataType, startingIndex: number, result: Vector2) {
    result.x = array[startingIndex++];
    result.y = array[startingIndex];

    return result;
  }

  /**
   * 将二维向量数组打包到数组中
   * @param array - 需要打包的二维向量数组
   * @param result - 保存打包后的数组
   * @returns
   */
  static packArray (array: Vector2[] | Readonly<Vector2>[], result: Vec2DataType) {
    const length = array.length;

    for (let i = 0; i < length; ++i) {
      Vector2.pack(array[i], result, i * 2);
    }

    return result;
  }

  /**
   * 将数组解包成二维向量数组
   * @param array
   * @param result
   * @returns
   */
  static unpackArray (array: Vec2DataType, result: Vector2[]) {
    const length = array.length;

    for (let i = 0; i < length; i += 2) {
      const index = i / 2;

      result[index] = Vector2.unpack(array, i, result[index]);
    }

    return result;
  }

  /**
   *
   * @param array
   * @returns
   */
  static fromArray (array: Vec2DataType) {
    return Vector2.unpack(array, 0, new Vector2());
  }

  /**
   * 返回二维向量 x 和 y 的最大值
   * @param cartesian
   * @returns
   */
  static maximumComponent (cartesian: Vector2 | Readonly<Vector2>) {
    return Math.max(cartesian.x, cartesian.y);
  }

  /**
   * 返回二维向量 x 和 y 的最小值
   * @param cartesian
   * @returns
   */
  static minimumComponent (cartesian: Vector2 | Readonly<Vector2>) {
    return Math.min(cartesian.x, cartesian.y);
  }

  /**
   * 返回一个新的二维向量，保存输入两个向量各分量的最小值
   * @param first
   * @param second
   * @param result
   * @returns
   */
  static minimumByComponent (first: Vector2 | Readonly<Vector2>, second: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = Math.min(first.x, second.x);
    result.y = Math.min(first.y, second.y);

    return result;
  }

  /**
   * 返回一个新的二维向量，保存输入两个向量各分量的最大值
   * @param first
   * @param second
   * @param result
   * @returns
   */
  static maximumByComponent (first: Vector2 | Readonly<Vector2>, second: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = Math.max(first.x, second.x);
    result.y = Math.max(first.y, second.y);

    return result;
  }

  /**
   * 返回二维向量模的平方
   * @param cartesian
   * @returns
   */
  static magnitudeSquared (cartesian: Vector2 | Readonly<Vector2>) {
    return cartesian.x * cartesian.x + cartesian.y * cartesian.y;
  }

  /**
   * 返回二维向量的模
   * @param cartesian
   * @returns
   */
  static magnitude (cartesian: Vector2 | Readonly<Vector2>) {
    return Math.sqrt(Vector2.magnitudeSquared(cartesian));
  }

  /**
   * 返回两个二维向量的距离
   * @param left
   * @param right
   * @returns
   */
  static distance (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    Vector2.subtract(left, right, distanceScratch);

    return Vector2.magnitude(distanceScratch);
  }

  /**
   * 返回两个二维向量距离的平方
   * @param left
   * @param right
   * @returns
   */
  static distanceSquared (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    Vector2.subtract(left, right, distanceScratch);

    return Vector2.magnitudeSquared(distanceScratch);
  }

  /**
   * 单位化二维向量
   * @param cartesian
   * @param result
   * @returns
   */
  static normalize (cartesian: Vector2 | Readonly<Vector2>, result: Vector2) {
    const magnitude = Vector2.magnitude(cartesian);

    result.x = cartesian.x / magnitude;
    result.y = cartesian.y / magnitude;

    return result;
  }

  /**
   * 计算两个二维向量的点积
   * @param left
   * @param right
   * @returns
   */
  static dot (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    return left.x * right.x + left.y * right.y;
  }

  /**
   * 计算两个二维向量的叉积
   * @param left
   * @param right
   * @returns
   */
  static cross (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    return left.x * right.y - left.y * right.x;
  }

  /**
   * 两个二维向量对应元素相乘
   * @param left
   * @param right
   * @param result
   * @returns
   */
  static multiplyComponents (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = left.x * right.x;
    result.y = left.y * right.y;

    return result;
  }

  /**
   * 两个二维向量对应元素相除（内部不会检查除数为 0 情况）
   * @param left
   * @param right
   * @param result
   * @returns
   */
  static divideComponents (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = left.x / right.x;
    result.y = left.y / right.y;

    return result;
  }

  /**
   * 两个二维向量对应元素相加
   * @param left
   * @param right
   * @param result
   * @returns
   */
  static add (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = left.x + right.x;
    result.y = left.y + right.y;

    return result;
  }

  /**
   * 两个二维向量对应元素相减
   * @param left
   * @param right
   * @param result
   * @returns
   */
  static subtract (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = left.x - right.x;
    result.y = left.y - right.y;

    return result;
  }

  /**
   * 二维向量元素乘一个标量
   * @param cartesian
   * @param scalar
   * @param result
   * @returns
   */
  static multiplyByScalar (cartesian: Vector2 | Readonly<Vector2>, scalar: number, result: Vector2) {
    result.x = cartesian.x * scalar;
    result.y = cartesian.y * scalar;

    return result;
  }

  /**
   * 二维向量元素除一个标量
   * @param cartesian
   * @param scalar
   * @param result
   * @returns
   */
  static divideByScalar (cartesian: Vector2 | Readonly<Vector2>, scalar: number, result: Vector2) {
    result.x = cartesian.x / scalar;
    result.y = cartesian.y / scalar;

    return result;
  }

  /**
   * 二维向量各元素相反数
   * @param cartesian
   * @param result
   * @returns
   */
  static negate (cartesian: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = -cartesian.x;
    result.y = -cartesian.y;

    return result;
  }

  /**
   * 二维向量各元素取绝对值
   * @param cartesian
   * @param result
   * @returns
   */
  static abs (cartesian: Vector2 | Readonly<Vector2>, result: Vector2) {
    result.x = Math.abs(cartesian.x);
    result.y = Math.abs(cartesian.y);

    return result;
  }

  /**
   * 计算两个向量的线性插值结果
   * @param start
   * @param end
   * @param t
   * @param result
   * @returns
   */
  static lerp (start: Vector2 | Readonly<Vector2>, end: Vector2 | Readonly<Vector2>, t: number, result: Vector2) {
    Vector2.multiplyByScalar(end, t, lerpScratch);

    result = Vector2.multiplyByScalar(start, 1.0 - t, result);

    return Vector2.add(lerpScratch, result, result);
  }

  /**
   * 计算两个二维向量的夹角角度
   * @param left
   * @param right
   * @returns
   */
  static angleBetween (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    Vector2.normalize(left, angleBetweenScratch);
    Vector2.normalize(right, angleBetweenScratch2);

    return MathUtils.acosClamped(
      Vector2.dot(angleBetweenScratch, angleBetweenScratch2)
    );
  }

  static mostOrthogonalAxis (cartesian: Vector2 | Readonly<Vector2>, result: Vector2) {
    const f = Vector2.normalize(cartesian, mostOrthogonalAxisScratch);

    Vector2.abs(f, f);

    if (f.x <= f.y) {
      Vector2.UNIT_X.copyTo(result);
    } else {
      Vector2.UNIT_Y.copyTo(result);
    }

    return result;
  }

  /**
   * 比较两个二维向量对应元素是否相等
   * @param left
   * @param right
   * @returns
   */
  static equals (left: Vector2 | Readonly<Vector2>, right: Vector2 | Readonly<Vector2>) {
    return (
      left === right ||
      left.x === right.x &&
      left.y === right.y);
  }

  /**
   *
   * @param cartesian
   * @param array
   * @param offset
   * @returns
   */
  static equalsArray (cartesian: Vector2 | Readonly<Vector2>, array: Vec2DataType, offset?: number) {
    offset = offset ?? 0;

    return cartesian.x === array[offset] && cartesian.y === array[offset + 1];
  }

  /**
   * 二维向量对应元素是否相等
   * @param left
   * @param right
   * @param relativeEpsilon
   * @param absoluteEpsilon
   * @returns
   */
  static equalsEpsilon (
    left: Vector2 | Readonly<Vector2>,
    right: Vector2 | Readonly<Vector2>,
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
        ))
    );
  }

  static max (a: Vector2, b: Vector2, result: Vector2) {
    Vector2.maximumByComponent(a, b, result);

    return result;
  }

  static min (a: Vector2, b: Vector2, result: Vector2) {
    Vector2.minimumByComponent(a, b, result);

    return result;
  }

  static mix (a: Vector2, b: Vector2, t: number, result: Vector2) {
    Vector2.lerp(a, b, t, result);

    return result;
  }

  static floor (a: Vector2, result: Vector2) {
    result.x = Math.floor(a.x);
    result.y = Math.floor(a.y);

    return result;
  }

  static ceil (a: Vector2, result: Vector2) {
    result.x = Math.ceil(a.x);
    result.y = Math.ceil(a.y);

    return result;
  }

  static round (a: Vector2, result: Vector2) {
    result.x = Math.round(a.x);
    result.y = Math.round(a.y);

    return result;
  }

  /**
   * 将向量导出 number[] 对象
   * @returns
   */
  toArray (): number[] {
    const array = new Array<number>(2);
    const result = Vector2.pack(this, array) as number[];

    return result;
  }

  /**
   * 克隆出一个新的二维向量
   * @returns
   */
  clone () {
    const result = Vector2.clone(this);

    return result;
  }

  /**
   * 将二维向量数据拷贝给 result
   * @param result
   * @returns
   */
  copyTo (result: Vector2) {
    result.x = this.x;
    result.y = this.y;

    return result;
  }

  /**
   * 与标量相加
   * @param value
   * @returns
   */
  addScalar (value: number) {
    this.x += value;
    this.y += value;

    return this;
  }

  /**
   * 与二维向量相加
   * @param vector
   * @returns
   */
  addVector (vector: Vector2) {
    const result = Vector2.add(this, vector, this);

    return result;
  }

  /**
   * 与标量相减
   * @param value
   * @returns
   */
  subScalar (value: number) {
    this.x -= value;
    this.y -= value;

    return this;
  }

  /**
   * 与向量相减
   * @param vector
   * @returns
   */
  subVector (vector: Vector2) {
    const result = Vector2.subtract(this, vector, this);

    return result;
  }

  /**
   * 与标量相乘
   * @param value
   * @returns
   */
  multiplyScalar (value: number) {
    const result = Vector2.multiplyByScalar(this, value, this);

    return result;
  }

  /**
   * 与向量相乘
   * @param vector
   * @returns
   */
  multiplyVector (vector: Vector2) {
    const result = Vector2.multiplyComponents(this, vector, this);

    return result;
  }

  /**
   * 与向量相除
   * @param vector
   * @returns
   */
  divideVector (vector: Vector2) {
    const result = Vector2.divideComponents(this, vector, this);

    return result;
  }

  /**
   * 与标量相除
   * @param value
   * @returns
   */
  divideScalar (value: number) {
    const result = Vector2.divideByScalar(this, value, this);

    return result;
  }

  /**
   * 分量中最小值
   * @returns
   */
  min () {
    const result = Vector2.minimumComponent(this);

    return result;
  }

  /**
   * 分量中最大值
   * @returns
   */
  max () {
    const result = Vector2.maximumComponent(this);

    return result;
  }

  /**
   * 分别使用 min 和 max 对应的分量对向量进行 clamp 运算
   * @param min
   * @param max
   * @returns
   */
  clamp (min: Vector2, max: Vector2): Vector2 {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));

    return this;
  }

  /**
   * 各分量分别进行 floor 运算
   * @returns
   */
  floor (): Vector2 {
    const result = Vector2.floor(this, this);

    return result;
  }

  /**
   * 各分量分别进行 ceil 运算
   * @returns
   */
  ceil (): Vector2 {
    const result = Vector2.ceil(this, this);

    return result;
  }

  /**
   * 各分量分别进行 round 运算
   * @returns
   */
  round (): Vector2 {
    const result = Vector2.round(this, this);

    return result;
  }

  /**
   * 各分量分别执行相反数运算
   * @returns
   */
  negate (): Vector2 {
    const result = Vector2.negate(this, this);

    return result;
  }

  /**
   * 与另一个向量点积运算
   * @param v
   * @returns
   */
  dot (v: Vector2) {
    const result = Vector2.dot(this, v);

    return result;
  }

  /**
   * 与另一个向量叉积运算
   * @param v
   * @returns
   */
  cross (v: Vector2): number {
    const result = Vector2.cross(this, v);

    return result;
  }

  /**
   * 计算向量长度
   * @returns
   */
  length () {
    const result = Vector2.magnitude(this);

    return result;
  }

  /**
   * 计算向量长度平方
   * @returns
   */
  lengthSquared () {
    const result = Vector2.magnitudeSquared(this);

    return result;
  }

  /**
   * 单位化向量
   * @returns
   */
  normalize () {
    const result = Vector2.normalize(this, this);

    return result;
  }

  /**
   * 计算向量与量一个向量夹角角度，弧度
   * @param v
   * @returns
   */
  angleTo (v: Vector2) {
    const result = Vector2.angleBetween(this, v);

    return result;
  }

  distanceTo (v: Vector2) {
    const result = Vector2.distance(this, v);

    return result;
  }

  distanceSquaredTo (v: Vector2) {
    const result = Vector2.distanceSquared(this, v);

    return result;
  }

  getData () {
    return this._data;
  }

  static ZERO = Object.freeze(new Vector2(0.0, 0.0));

  static ONE = Object.freeze(new Vector2(1.0, 1.0));

  static UNIT_X = Object.freeze(new Vector2(1.0, 0.0));

  static UNIT_Y = Object.freeze(new Vector2(0.0, 1.0));
}

const distanceScratch = new Vector2();

const lerpScratch = new Vector2();

const angleBetweenScratch = new Vector2();

const angleBetweenScratch2 = new Vector2();

const mostOrthogonalAxisScratch = new Vector2();

export { Vector2 };
