import type * as spec from '@galacean/effects-specification';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import { createValueGetter } from '../math';
import { alphaMaskFrag } from '../shader';
import { Texture, TextureLoadAction } from '../texture';
import { CopyPass } from './gaussian';
import { GPUCapability } from '../render';
import type { Composition } from '../composition';
import type { Engine } from '../engine';

export function createAlphaMaskShader (): FilterShaderDefine[] {
  return [{
    fragment: alphaMaskFrag,
    shaderCacheId: 'alpha-mask',
  }];
}

export function registerAlphaMaskFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const { xOpacity, yOpacity } = filter as spec.AlphaMaskFilterParams;
  const engine = composition.renderer.engine;
  const renderer = composition.renderer;
  const uAlphaXSample = createSampler(engine, xOpacity);
  const uAlphaYSample = createSampler(engine, yOpacity, true);

  const textureFilter = engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const alphaMaskPass = new CopyPass(renderer, {
    name: 'alphaMaskCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    mesh: {
      fragment: alphaMaskFrag,
      shaderCacheId: 'alpha-mask',
      materialStates: {
        blending: false,
        depthTest: false,
        culling: false,
      },
      uniformValues: {
        uAlphaXSample,
        uAlphaYSample,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [alphaMaskPass],
    },
  };
}

function createSampler (engine: Engine, value?: spec.FixedNumberExpression, reverse?: boolean) {
  const exp = createValueGetter(value || 1);
  const width = value ? 256 : 1;
  const data = new Uint8Array(width);

  for (let i = 0; i < width; i++) {
    const p = i / (width - 1);

    data[i] = Math.round(exp.getValue((reverse ? 1 - p : p)) * 255);
  }

  return Texture.createWithData(engine, { width: width, height: 1, data }, { format: glContext.LUMINANCE });
}
