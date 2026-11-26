import type { Point3 } from '../../math/types';
import { add3, sub3, mul3, length3, unit3, cross3 } from '../../math/vector3';

export interface CameraEditData {
  position: Point3,
  target: Point3,
  up: Point3,
  /** Field of view in degrees along the axis specified by the camera's clip mode. */
  fov: number,
}

/** Camera calculations are independent of the scene document and its animated cameras. */
export function orbitEditorCamera (camera: CameraEditData, dx: number, dy: number): CameraEditData {
  const offset = sub3(camera.position, camera.target), radius = Math.max(0.001, length3(offset));
  const theta = Math.atan2(offset.x, offset.z) - dx * 0.008;
  const phi = Math.max(0.01, Math.min(Math.PI - 0.01, Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) - dy * 0.008));

  return { ...camera, up: { x: 0, y: 1, z: 0 }, position: add3(camera.target, { x: radius * Math.sin(phi) * Math.sin(theta), y: radius * Math.cos(phi), z: radius * Math.sin(phi) * Math.cos(theta) }) };
}
export function dollyEditorCamera (camera: CameraEditData, factor: number): CameraEditData {
  const delta = sub3(camera.position, camera.target), distance = length3(delta);

  return { ...camera, position: add3(camera.target, mul3(unit3(delta), Math.max(0.001, Math.min(1e6, distance * factor)))) };
}

/** Rotate the viewing direction around a stationary eye. */
export function lookEditorCamera (camera: CameraEditData, dx: number, dy: number): CameraEditData {
  const rotated = orbitEditorCamera({ ...camera, position: camera.target, target: camera.position }, dx, -dy);

  return { ...camera, target: rotated.position, up: rotated.up };
}

/** Translate the eye and target together in camera axes. */
export function flyEditorCamera (camera: CameraEditData, side: number, vertical: number, forward: number, distance: number): CameraEditData {
  const direction = unit3(sub3(camera.target, camera.position)), right = unit3(cross3(direction, camera.up));
  const delta = mul3(add3(add3(mul3(right, side), mul3(camera.up, vertical)), mul3(direction, forward)), distance);

  return { ...camera, position: add3(camera.position, delta), target: add3(camera.target, delta) };
}
