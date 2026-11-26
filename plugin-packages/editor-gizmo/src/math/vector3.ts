import type { Point3 } from './types';

export const add3 = (a: Point3, b: Point3): Point3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul3 = (a: Point3, k: number): Point3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot3 = (a: Point3, b: Point3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Point3, b: Point3): Point3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const length3 = (a: Point3): number => Math.hypot(a.x, a.y, a.z);
export const unit3 = (a: Point3): Point3 => mul3(a, 1 / (length3(a) || 1));
