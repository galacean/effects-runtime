import type { spec } from '@galacean/effects';
import { math } from '@galacean/effects';
import { GeometryData } from './geometry';

const { Euler, Vector3, Matrix4 } = math;

/**
 *
 */
export class FrustumGeometryData extends GeometryData {
  /**
   *
   * @param position
   * @param rotation
   * @param fov
   * @param aspect
   * @param near
   * @param far
   */
  constructor (
    position: spec.vec3,
    rotation: spec.vec3,
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) {
    super();

    const fovY = fov / 180 * Math.PI;
    const ratio = aspect;
    const halfY = far * Math.tan(fovY / 2);
    const halfX = halfY * ratio;
    const point1 = new Vector3(halfX, halfY, far);
    const point2 = new Vector3(-halfX, halfY, far);
    const point3 = new Vector3(-halfX, -halfY, far);
    const point4 = new Vector3(halfX, -halfY, far);
    const matrix = Euler.fromArray(rotation).toMatrix4(new Matrix4());
    const result1 = matrix.transformPoint(point1).add(position);
    const result2 = matrix.transformPoint(point2).add(position);
    const result3 = matrix.transformPoint(point3).add(position);
    const result4 = matrix.transformPoint(point4).add(position);

    this.points.push(
      ...position,
      ...result1.toArray(), ...result2.toArray(),
      ...result3.toArray(), ...result4.toArray()
    );
    this.indices.push(0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1);
  }
}
