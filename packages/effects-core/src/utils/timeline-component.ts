// import { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';

export interface TimelineComponentOptions {
  sizeOverLifetime?: spec.SizeOverLifetime,
  rotationOverLifetime?: spec.RotationOverLifetime,
  positionOverLifetime?: spec.PositionOverLifetime,
}