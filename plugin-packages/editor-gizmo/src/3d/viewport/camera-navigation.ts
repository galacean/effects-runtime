import { math } from '@galacean/effects';
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
  if (!dx && !dy) { return camera; }
  const offset = new math.Vector3().copyFrom(sub3(camera.position, camera.target));
  const right = new math.Vector3().copyFrom(unit3(cross3(camera.up, offset)));
  const rotation = new math.Quaternion().setFromAxisAngle(new math.Vector3(0, 1, 0), -dx * 0.003)
    .multiply(new math.Quaternion().setFromAxisAngle(right, -dy * 0.003));

  offset.applyQuaternion(rotation);

  return {
    ...camera,
    position: add3(camera.target, offset),
    up: new math.Vector3().copyFrom(camera.up).applyQuaternion(rotation),
  };
}
export function dollyEditorCamera (camera: CameraEditData, factor: number): CameraEditData {
  const delta = sub3(camera.position, camera.target), distance = length3(delta);

  return { ...camera, position: add3(camera.target, mul3(unit3(delta), Math.max(0.001, Math.min(1e6, distance * factor)))) };
}

/** Rotate the viewing direction around a stationary eye. */
export function lookEditorCamera (camera: CameraEditData, dx: number, dy: number): CameraEditData {
  const rotated = orbitEditorCamera(camera, dx, dy);

  return { ...camera, target: sub3(camera.position, sub3(rotated.position, camera.target)), up: rotated.up };
}

/** Translate the eye and target together in camera axes. */
export function flyEditorCamera (camera: CameraEditData, side: number, vertical: number, forward: number, distance: number): CameraEditData {
  const direction = unit3(sub3(camera.target, camera.position)), right = unit3(cross3(direction, camera.up));
  const up = unit3(cross3(right, direction));
  const delta = mul3(unit3(add3(add3(mul3(right, side), mul3(up, vertical)), mul3(direction, forward))), distance);

  return { ...camera, position: add3(camera.position, delta), target: add3(camera.target, delta) };
}
