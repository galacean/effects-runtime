import type { Point3, Ray3 } from './types';
import { dot3, sub3 } from './vector3';

/** Parameter of the closest point on the axis to the ray's supporting line. Both directions are unit vectors. */
export function rayAxisParameter (ray: Ray3, origin: Point3, axis: Point3): number | undefined {
  const b = dot3(ray.direction, axis), denominator = 1 - b * b;

  if (Math.abs(denominator) < 1e-8) { return; }
  const delta = sub3(ray.origin, origin);

  return (dot3(delta, axis) - b * dot3(delta, ray.direction)) / denominator;
}
