import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import type { GPUCapabilityDetail } from '../../render';
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

export let maxSpriteMeshItemCount = 8;

export function setSpriteMeshMaxItemCountByGPU (gpuCapability: GPUCapabilityDetail) {
  if (gpuCapability.maxVertexUniforms >= 256) {
    return maxSpriteMeshItemCount = 32;
  } else if (gpuCapability.maxVertexUniforms >= 128) {
    return maxSpriteMeshItemCount = 16;
  }
}

// TODO: 只有单测用
export function setMaxSpriteMeshItemCount (count: number) {
  maxSpriteMeshItemCount = count;
}
