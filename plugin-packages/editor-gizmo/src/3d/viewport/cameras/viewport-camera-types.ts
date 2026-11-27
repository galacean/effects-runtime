import type { Point3 } from '../../../math/types';

export interface ViewportCameraState {
  position: Point3,
  target: Point3,
  up: Point3,
  /** Field of view in degrees along the axis specified by the camera's clip mode. */
  fov: number,
}

export interface ViewportCameraEvent {
  camera: ViewportCameraState,
  phase: 'start' | 'update' | 'commit' | 'cancel',
}
