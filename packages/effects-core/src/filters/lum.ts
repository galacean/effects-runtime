import type * as spec from '@galacean/effects-specification';
import type { Composition } from '../composition';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import { copyFrag } from '../shader';
import { TextureLoadAction } from '../texture';
import { CopyPass } from './gaussian';

export function createLumShader (): FilterShaderDefine[] {
  return [{ fragment: copyFrag }];
}

export function registerLumFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const renderer = composition.renderer;
  const texturefilter = renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const lumCopyPass = new CopyPass(renderer, {
    name: 'lumCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: texturefilter, magFilter: texturefilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    mesh: {
      fragment: copyFrag,
      uniformValues: {
        uFilterParams: [1, 0, 0, 0],
      },
      materialStates: {
        blending: false,
        depthTest: false,
        culling: false,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
    },
    prePasses: [lumCopyPass],
    renderPassDelegate: {},
  };
}
