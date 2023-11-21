import type * as spec from '@galacean/effects-specification';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { alphaFrameFrag } from '../shader';
import { CopyPass } from './gaussian';
import { glContext } from '../gl';
import { TextureLoadAction } from '../texture';
import type { Composition } from '../composition';

export function createAlphaFrameShader (): FilterShaderDefine[] {
  return [
    { fragment: alphaFrameFrag, shaderCacheId: 'alpha-frame' },
    { fragment: alphaFrameFrag, isParticle: true },
  ];
}

export function registerAlphaFrameFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const { colorRange = [0.5, 1], alphaRange = [0, 0.5] } = filter as spec.AlphaFrameFilterParams;
  const uTexRange = [alphaRange[0], alphaRange[1] - alphaRange[0], colorRange[0], colorRange[1] - colorRange[0]];
  const renderer = composition.renderer;

  const textureFilter = renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const alphaFramePass = new CopyPass(renderer, {
    name: 'alphaFrameCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    particle: {
      fragment: alphaFrameFrag,
      uniformValues: {
        uTexRange,
      },
    },
    mesh: {
      fragment: alphaFrameFrag,
      shaderCacheId: 'alpha-frame',
      materialStates: {
        blending: false,
      },
      uniformValues: {
        uTexRange,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [alphaFramePass],
    },
  };
}
