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
  const offset = sub3(camera.position, camera.target), radius = Math.max(0.001, length3(offset));
  const sensitivity = Math.PI / 720;
  // The up vector retains the heading at the poles, where the horizontal offset vanishes.
  const heading = Math.hypot(offset.x, offset.z) > radius * 1e-6
    ? Math.atan2(offset.x, offset.z)
    : Math.atan2(-camera.up.x * Math.sign(offset.y), -camera.up.z * Math.sign(offset.y));
  const yaw = heading - dx * sensitivity;
  const pitch = Math.max(-1.57, Math.min(1.57,
    Math.asin(Math.max(-1, Math.min(1, offset.y / radius))) + dy * sensitivity));
  const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch), cosPitch = Math.cos(pitch);

  return {
    ...camera,
    position: add3(camera.target, { x: radius * cosPitch * sinYaw, y: radius * sinPitch, z: radius * cosPitch * cosYaw }),
    up: { x: -sinPitch * sinYaw, y: cosPitch, z: -sinPitch * cosYaw },
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
  const delta = mul3(add3(add3(mul3(right, side), mul3(up, vertical)), mul3(direction, forward)), distance);

  return { ...camera, position: add3(camera.position, delta), target: add3(camera.target, delta) };
}
