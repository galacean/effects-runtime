import type { Point3, Ray3 } from './spatial-edit-host';
export const add3 = (a: Point3, b: Point3): Point3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul3 = (a: Point3, k: number): Point3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot3 = (a: Point3, b: Point3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Point3, b: Point3): Point3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const length3 = (a: Point3): number => Math.hypot(a.x, a.y, a.z);
export const unit3 = (a: Point3): Point3 => mul3(a, 1 / (length3(a) || 1));
export function rayPlanePoint (ray: Ray3, origin: Point3, normal: Point3): Point3 | undefined {
  const denominator = dot3(ray.direction, normal);

  if (Math.abs(denominator) < 1e-8) { return; }
  const distance = dot3(sub3(origin, ray.origin), normal) / denominator;

  return distance >= 0 ? add3(ray.origin, mul3(ray.direction, distance)) : undefined;
}
export function rayAxisParameter (ray: Ray3, origin: Point3, axis: Point3): number | undefined {
  const b = dot3(ray.direction, axis), denominator = 1 - b * b;

  if (Math.abs(denominator) < 1e-8) { return; }
  const delta = sub3(ray.origin, origin);

  return (dot3(delta, axis) - b * dot3(delta, ray.direction)) / denominator;
}
