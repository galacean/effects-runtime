import type * as spec from '@galacean/effects-specification';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import { createValueGetter, vecNormalize } from '../math';
import { distortionFrag, distortionVert } from '../shader';
import { TextureLoadAction } from '../texture';
import { CopyPass } from './gaussian';
import type { Composition } from '../composition';

export function createDistortionShader (filter: spec.FilterParams): FilterShaderDefine[] {
  const { period, waveMovement, strength } = filter as spec.DistortionFilterParams;

  return [
    {
      fragment: distortionFrag,
      shaderCacheId: 'distortion',
    },
    {
      fragment: distortionFrag,
      vertex: distortionVert,
      isParticle: true,
      uniforms: [period, waveMovement, strength],
    },
  ];
}

export function registerDistortionFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const { center = [0.5, 0.5], direction = [1, 0], period, waveMovement, strength } = filter as spec.DistortionFilterParams;
  const dir = vecNormalize(direction);
  const uWaveParams = [center[0], center[1], dir[0], dir[1]];
  const uPeriodValue = createValueGetter(period);
  const uMovementValue = createValueGetter(waveMovement);
  const uStrengthValue = createValueGetter(strength);
  const PI2 = Math.PI * 2;
  const renderer = composition.renderer;

  const textureFilter = renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;

  const distortionPass = new CopyPass(renderer, {
    name: 'distortionCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    particle: {
      fragment: distortionFrag,
      vertex: distortionVert,
      uniforms: {
        uPeriodValue,
        uMovementValue,
        uStrengthValue,
      },
      uniformValues: {
        uWaveParams,
      },
    },
    mesh: {
      shaderCacheId: 'distortion',
      fragment: distortionFrag,
      materialStates: {
        blending: false,
        culling: false,
      },
      variables: {
        vWaveParams (life) {
          return [
            uPeriodValue.getValue(life) * PI2,
            uMovementValue.getValue(life) * PI2,
            uStrengthValue.getValue(life),
            0,
          ];
        },
      },
      uniformValues: {
        uWaveParams,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [distortionPass],
    },
  };
}
