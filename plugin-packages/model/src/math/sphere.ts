import { Box3 } from './box3';
import { Vector3 } from './vector3';

/**
 * 球体的几何表示
 */
class Sphere {
  /** 球半径 */
  radius: number;
  /** 球中心点 */
  center: Vector3;

  constructor (center: Vector3 = new Vector3(), radius = -1) {
    this.center = center;
    this.radius = radius;
  }

  set (center: Vector3, radius: number): Sphere {
    this.center.copyFrom(center);
    this.radius = radius;

    return this;
  }

  /**
   * 从顶点数组中构造一个球
   * @param points
   * @param optionalCenter
   * @returns
   */
  setFromPoints (points: Vector3[], optionalCenter?: Vector3): Sphere {
    const center = this.center;

    if (optionalCenter !== undefined) {
      center.copyFrom(optionalCenter);
    } else {
      new Box3().setFromPoints(points).getCenter(center);
    }

    let maxRadiusSq = 0;

    for (let i = 0, il = points.length; i < il; i++) {
      maxRadiusSq = Math.max(maxRadiusSq, center.distanceSquaredTo(points[i]));
    }

    this.radius = Math.sqrt(maxRadiusSq);

    return this;
  }

  copyFrom (sphere: Sphere): Sphere {
    this.center.copyFrom(sphere.center);
    this.radius = sphere.radius;

    return this;
  }

  isEmpty (): boolean {
    return (this.radius < 0);
  }

  makeEmpty (): Sphere {
    this.center.set(0, 0, 0);
    this.radius = -1;

    return this;
  }

  /**
   * 判断点是否在球内（包含球面）
   * @param point
   * @returns
   */
  containsPoint (point: Vector3): boolean {
    return (point.distanceSquaredTo(this.center) <= (this.radius * this.radius));
  }

  /**
   * 点到球的距离
   * @param point
   * @returns
   */
  distanceToPoint (point: Vector3): number {
    return (point.distanceTo(this.center) - this.radius);
  }

  /**
   * 判断球 this 与球 other 是否相交
   * @param other
   * @returns
   */
  intersectsSphere (other: Sphere): boolean {
    const radiusSum = this.radius + other.radius;

    return other.center.distanceSquaredTo(this.center) <= (radiusSum * radiusSum);
  }

  /**
   * 判断球与包围盒是否相交
   * @param box
   * @returns
   */
  intersectsBox (box: Box3): boolean {
    return box.intersectsSphere(this);
  }

  /**
   * 限制点只能取球内值
   * @param point
   * @param target
   * @returns
   */
  clampPoint (point: Vector3, target: Vector3): Vector3 {
    const deltaLengthSq = this.center.distanceSquaredTo(point);

    target.copyFrom(point);

    if (deltaLengthSq > (this.radius * this.radius)) {
      target.subVector(this.center).normalize();
      target.multiplyScalar(this.radius).addVector(this.center);
    }

    return target;
  }

  /**
   * 获取球体的包围盒
   * @param target
   * @returns
   */
  getBoundingBox (target: Box3): Box3 {
    if (target === undefined) { target = new Box3(); }

    if (this.isEmpty()) {
      // Empty sphere produces empty bounding box
      target.makeEmpty();

      return target;
    }

    target.set(this.center, this.center);
    target.expandByScalar(this.radius);

    return target;
  }

  /**
   * 球的三维空间平移
   * @param offset
   * @returns
   */
  translate (offset: Vector3): Sphere {
    this.center.addVector(offset);

    return this;
  }

  /**
   * 通过空间点扩展/缩放球
   * @param offset
   * @returns
   */
  expandByPoint (point: Vector3): Sphere {
    // from https://github.com/juj/MathGeoLib/blob/2940b99b99cfe575dd45103ef20f4019dee15b54/src/Geometry/Sphere.cpp#L649-L671
    const toPoint = point.clone().subVector(this.center);
    const lengthSq = toPoint.lengthSquared();

    if (lengthSq > (this.radius * this.radius)) {
      const length = Math.sqrt(lengthSq);
      const missingRadiusHalf = (length - this.radius) * 0.5;

      // Nudge this sphere towards the target point. Add half the missing distance to radius,
      // and the other half to position. This gives a tighter enclosure, instead of if
      // the whole missing distance were just added to radius.

      this.center.addVector(toPoint.multiplyScalar(missingRadiusHalf / length));
      this.radius += missingRadiusHalf;
    }

    return this;
  }

  /**
   * 球的并集
   * @param offset
   * @returns
   */
  union (sphere: Sphere): Sphere {
    // from https://github.com/juj/MathGeoLib/blob/2940b99b99cfe575dd45103ef20f4019dee15b54/src/Geometry/Sphere.cpp#L759-L769

    // To enclose another sphere into this sphere, we only need to enclose two points:
    // 1) Enclose the farthest point on the other sphere into this sphere.
    // 2) Enclose the opposite point of the farthest point into this sphere.

    const v1 = new Vector3();
    const toFarthestPoint = sphere.center.clone().subVector(this.center);

    toFarthestPoint.normalize().multiplyScalar(sphere.radius);

    this.expandByPoint(v1.copyFrom(sphere.center).addVector(toFarthestPoint));
    this.expandByPoint(v1.copyFrom(sphere.center).subVector(toFarthestPoint));

    return this;
  }

  equals (sphere: Sphere): boolean {
    return Vector3.equals(sphere.center, this.center) && (sphere.radius === this.radius);
  }

  clone () {
    return new Sphere().copyFrom(this);
  }
}

export { Sphere };
