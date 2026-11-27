import { math } from '@galacean/effects';
import type { Point3 } from '../../../math/types';
import type { ViewportCameraState } from './viewport-camera-types';
import { add3, sub3, mul3, length3, unit3, cross3 } from '../../../math/vector3';

const vector = (point: Point3) => new math.Vector3(point.x, point.y, point.z);

function lerpPoint (a: Point3, b: Point3, t: number): Point3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function cameraOrientation (camera: ViewportCameraState): math.Quaternion {
  return new math.Quaternion().setFromRotationMatrix(
    new math.Matrix4().lookAt(vector(camera.position), vector(camera.target), vector(camera.up)));
}

export function interpolateCamera (from: ViewportCameraState, to: ViewportCameraState, t: number): ViewportCameraState {
  const target = lerpPoint(from.target, to.target, t);
  const orientation = cameraOrientation(from).slerp(cameraOrientation(to), t);
  const direction = new math.Vector3(0, 0, 1).applyQuaternion(orientation);
  const distance = length3(sub3(from.position, from.target)) + (length3(sub3(to.position, to.target)) - length3(sub3(from.position, from.target))) * t;
  const up = new math.Vector3(0, 1, 0).applyQuaternion(orientation);

  return { ...to, position: add3(target, mul3(direction, distance)), target, up };
}

/** Camera calculations are independent of the scene document and its animated cameras. */
export function orbitEditorCamera (camera: ViewportCameraState, dx: number, dy: number): ViewportCameraState {
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
export function dollyEditorCamera (camera: ViewportCameraState, factor: number): ViewportCameraState {
  const delta = sub3(camera.position, camera.target), distance = length3(delta);

  return { ...camera, position: add3(camera.target, mul3(unit3(delta), Math.max(0.001, Math.min(1e6, distance * factor)))) };
}

/** Rotate the viewing direction around a stationary eye. */
export function lookEditorCamera (camera: ViewportCameraState, dx: number, dy: number): ViewportCameraState {
  const rotated = orbitEditorCamera(camera, dx, dy);

  return { ...camera, target: sub3(camera.position, sub3(rotated.position, camera.target)), up: rotated.up };
}

/** Translate the eye and target together in camera axes. */
export function flyEditorCamera (camera: ViewportCameraState, side: number, vertical: number, forward: number, distance: number): ViewportCameraState {
  const direction = unit3(sub3(camera.target, camera.position)), right = unit3(cross3(direction, camera.up));
  const up = unit3(cross3(right, direction));
  const delta = mul3(unit3(add3(add3(mul3(right, side), mul3(up, vertical)), mul3(direction, forward))), distance);

  return { ...camera, position: add3(camera.position, delta), target: add3(camera.target, delta) };
}
