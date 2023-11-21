import type { spec } from '@galacean/effects';
import { mat3FromRotationZYX, vec3MulMat3ByPoint, vecAdd } from '../math/vec';
import { GeometryData } from './geometry';

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
    const point1 = vecAdd([], position, [halfX, halfY, far]) as [number, number, number];
    const point2 = vecAdd([], position, [-halfX, halfY, far]) as [number, number, number];
    const point3 = vecAdd([], position, [-halfX, -halfY, far]) as [number, number, number];
    const point4 = vecAdd([], position, [halfX, -halfY, far]) as [number, number, number];

    const matrix = mat3FromRotationZYX([], rotation[0], rotation[1], rotation[2]);

    const result1 = vec3MulMat3ByPoint([], point1, matrix, position);
    const result2 = vec3MulMat3ByPoint([], point2, matrix, position);
    const result3 = vec3MulMat3ByPoint([], point3, matrix, position);
    const result4 = vec3MulMat3ByPoint([], point4, matrix, position);

    this.points.push(...position, ...result1, ...result2, ...result3, ...result4);
    this.indices.push(0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1);
  }
}
