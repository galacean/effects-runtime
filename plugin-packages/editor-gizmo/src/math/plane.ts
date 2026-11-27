import type { Point3, Ray3 } from './types';
import { add3, dot3, mul3, sub3 } from './vector3';

export function rayPlanePoint (ray: Ray3, origin: Point3, normal: Point3): Point3 | undefined {
  const denominator = dot3(ray.direction, normal);

  if (Math.abs(denominator) < 1e-8) { return; }
  const distance = dot3(sub3(origin, ray.origin), normal) / denominator;

  return distance >= 0 ? add3(ray.origin, mul3(ray.direction, distance)) : undefined;
}
