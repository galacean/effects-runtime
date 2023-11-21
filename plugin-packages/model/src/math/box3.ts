import type { Sphere } from './sphere';
import { Matrix4 } from './matrix4';
import { Vector3 } from './vector3';

/**
 * 三维包围盒
 */
class Box3 {
  constructor (
    public min: Vector3 = new Vector3(Infinity, Infinity, Infinity),
    public max: Vector3 = new Vector3(-Infinity, -Infinity, -Infinity),
  ) { }

  set (min: Vector3, max: Vector3): Box3 {
    this.min.copyFrom(min);
    this.max.copyFrom(max);

    return this;
  }

  /**
   * 由数组构建三维包围盒
   * @param array
   * @returns
   */
  setFromArray (array: number[]): Box3 {
    let minX = Number(Infinity);
    let minY = Number(Infinity);
    let minZ = Number(Infinity);

    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0, l = array.length; i < l; i += 3) {
      const x = array[i];
      const y = array[i + 1];
      const z = array[i + 2];

      if (x < minX) { minX = x; }
      if (y < minY) { minY = y; }
      if (z < minZ) { minZ = z; }

      if (x > maxX) { maxX = x; }
      if (y > maxY) { maxY = y; }
      if (z > maxZ) { maxZ = z; }
    }

    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);

    return this;
  }

  /**
   * 由三维空间点构建三维包围盒
   * @param points
   * @returns
   */
  setFromPoints (points: Vector3[]): Box3 {
    this.makeEmpty();

    for (let i = 0, il = points.length; i < il; i++) {
      this.expandByPoint(points[i]);
    }

    return this;
  }

  /**
   * 由三维空间点（包围盒中心）和大小确定包围盒
   * @param center
   * @param size
   * @returns
   */
  setFromCenterAndSize (center: Vector3, size: Vector3): Box3 {
    const halfSize = size.clone().multiplyScalar(0.5);

    this.min.copyFrom(center).subVector(halfSize);
    this.max.copyFrom(center).subVector(halfSize);

    return this;
  }

  clone (): Box3 {
    return new Box3().copyFrom(this);
  }

  copyFrom (box: Box3): Box3 {
    this.min.copyFrom(box.min);
    this.max.copyFrom(box.max);

    return this;
  }

  makeEmpty (): Box3 {
    this.min.x = this.min.y = this.min.z = Number(Infinity);
    this.max.x = this.max.y = this.max.z = -Infinity;

    return this;
  }

  isEmpty (): boolean {
    // this is a more robust check for empty than ( volume <= 0 ) because volume can get positive with two negative axes

    return (this.max.x < this.min.x) || (this.max.y < this.min.y) || (this.max.z < this.min.z);
  }

  /**
   * 获取三维包围盒中心
   * @param target
   * @returns
   */
  getCenter (target: Vector3): Vector3 {
    if (this.isEmpty()) {
      target.set(0, 0, 0);
    } else {
      Vector3.add(this.min, this.max, target).multiplyScalar(0.5);
    }

    return target;
  }

  /**
   * 获取三维包围盒大小
   * @param target
   * @returns
   */
  getSize (target: Vector3): Vector3 {
    if (this.isEmpty()) {
      target.set(0, 0, 0);
    } else {
      Vector3.subtract(this.max, this.min, target);
    }

    return target;
  }

  /**
   * 通过三维空间点扩展三维包围盒
   * @param point
   * @returns
   */
  expandByPoint (point: Vector3): Box3 {
    Vector3.min(this.min, point, this.min);
    Vector3.max(this.max, point, this.max);

    return this;
  }

  /**
   * 通过三维向量扩展三维包围盒
   * @param vector
   * @returns
   */
  expandByVector (vector: Vector3): Box3 {
    this.min.subVector(vector);
    this.max.addVector(vector);

    return this;
  }

  /**
   * 通过实数扩展三维包围盒
   * @param scalar
   * @returns
   */
  expandByScalar (scalar: number): Box3 {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);

    return this;
  }

  /**
   * 通过包围盒扩展三维包围盒
   * @param box
   * @returns
   */
  expandByBox (box: Box3): Box3 {
    Vector3.min(this.min, box.min, this.min);
    Vector3.max(this.max, box.max, this.max);

    return this;
  }

  /**
   * 判断三维包围盒与三维空间点的关系
   * @param point
   * @returns
   */
  containsPoint (point: Vector3): boolean {
    return !(point.x < this.min.x || point.x > this.max.x
      || point.y < this.min.y || point.y > this.max.y
      || point.z < this.min.z || point.z > this.max.z);
  }

  /**
   * 判断 this 是否包含 other
   * @param other
   * @returns
   */
  containsBox (other: Box3): boolean {
    return this.min.x <= other.min.x && other.max.x <= this.max.x
      && this.min.y <= other.min.y && other.max.y <= this.max.y
      && this.min.z <= other.min.z && other.max.z <= this.max.z;
  }

  /**
   * 判断三维包围盒 this 与 other 是否相交
   * @param other
   * @returns
   */
  intersectsBox (other: Box3): boolean {
    // using 6 splitting planes to rule out intersections.
    return !(other.max.x < this.min.x || other.min.x > this.max.x
      || other.max.y < this.min.y || other.min.y > this.max.y
      || other.max.z < this.min.z || other.min.z > this.max.z);
  }

  /**
   * 判断三维包围盒和球是否相交
   * @param sphere
   * @returns
   */
  intersectsSphere (sphere: Sphere) {
    // Find the point on the AABB closest to the sphere center.
    const _vector = new Vector3();

    this.clampPoint(sphere.center, _vector);

    // If that point is inside the sphere, the AABB and sphere intersect.
    return _vector.distanceSquaredTo(sphere.center) <= (sphere.radius * sphere.radius);
  }

  /**
   * 限制空间点位于三维包围盒内
   * @param point
   * @param target
   * @returns
   */
  clampPoint (point: Vector3, target: Vector3): Vector3 {
    return target.copyFrom(point).clamp(this.min, this.max);
  }

  /**
   * 三维空间点到三维包围盒的距离
   * @param point
   * @returns
   */
  distanceToPoint (point: Vector3): number {
    const clampedPoint = point.clone().clamp(this.min, this.max);

    return clampedPoint.subVector(point).length();
  }

  /**
   * 通过包围盒获取包围球
   * @param target
   * @returns
   */
  getBoundingSphere (target: Sphere) {
    this.getCenter(target.center);

    const _vector = new Vector3();

    target.radius = this.getSize(_vector).length() * 0.5;

    return target;
  }

  /**
   * 三维包围盒交集
   * @param box
   * @returns
   */
  intersect (box: Box3): Box3 {
    this.min.max(box.min);
    this.max.min(box.max);

    // ensure that if there is no overlap, the result is fully empty, not slightly empty with non-inf/+inf values that will cause subsequence intersects to erroneously return valid values.
    if (this.isEmpty()) { this.makeEmpty(); }

    return this;
  }

  /**
   * 三维包围盒并集
   * @param box
   * @returns
   */
  union (box: Box3): Box3 {
    this.min.min(box.min);
    this.max.max(box.max);

    return this;
  }

  /**
   * 通过矩阵变化三维包围盒
   * @param matrix
   * @returns
   */
  transform (matrix: Matrix4): Box3 {
    // transform of empty box is an empty box.
    if (this.isEmpty()) { return this; }

    const points: Vector3[] = [];

    // NOTE: I am using a binary pattern to specify all 2^3 combinations below
    points[0] = new Vector3(this.min.x, this.min.y, this.min.z); // 000
    points[1] = new Vector3(this.min.x, this.min.y, this.max.z); // 001
    points[2] = new Vector3(this.min.x, this.max.y, this.min.z); // 010
    points[3] = new Vector3(this.min.x, this.max.y, this.max.z); // 011
    points[4] = new Vector3(this.max.x, this.min.y, this.min.z); // 100
    points[5] = new Vector3(this.max.x, this.min.y, this.max.z); // 101
    points[6] = new Vector3(this.max.x, this.max.y, this.min.z); // 110
    points[7] = new Vector3(this.max.x, this.max.y, this.max.z); // 111
    points.forEach(p => Matrix4.multiplyByPoint(matrix, p, p));

    this.setFromPoints(points);

    return this;
  }

  /**
   * 根据向量改变三维包围盒位置
   * @param offset
   * @returns
   */
  translate (offset: Vector3): Box3 {
    this.min.addVector(offset);
    this.max.addVector(offset);

    return this;
  }

  equals (other: Box3): boolean {
    return Vector3.equals(other.min, this.min) && Vector3.equals(other.max, this.max);
  }
}

export { Box3 };
