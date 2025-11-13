import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import type { Transform } from '../../transform';

export type SpriteRenderData = {
  life: number,
  transform: Transform,
  visible?: boolean,
  startSize?: Vector3,
  color?: spec.vec4,
  texOffset?: spec.vec4,
  active?: boolean,
  anchor?: spec.vec3,
};

export type SpriteRegionData = {
  color: spec.vec4,
  position: spec.vec3,
  quat: spec.vec4,
  size: spec.vec2,
};