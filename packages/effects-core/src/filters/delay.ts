import type * as spec from '@galacean/effects-specification';
import type { Composition } from '../composition';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import type { Renderer, RenderPassOptions } from '../render';
import { getTextureSize, RenderPass } from '../render';
import { delayFrag } from '../shader';
import { Texture, TextureLoadAction, TextureSourceType } from '../texture';

export class DelayPass extends RenderPass {
  prePassTexture: Texture;

  constructor (renderer: Renderer, options: RenderPassOptions) {
    super(renderer, options);
  }

  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()[0];

    renderer.setFrameBuffer(this.frameBuffer!);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[0].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[0].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    this.meshes[1].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uSamplerPre', this.prePassTexture);
    this.meshes[1].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    const renderQueue = [this.meshes[0], this.meshes[1]];

    renderer.renderMeshes(renderQueue);
  }
}
export function createDelayShader (): FilterShaderDefine[] {
  return [{
    fragment: delayFrag,
    shaderCacheId: 'delay',
  }];
}

export function registerDelayFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {

  // FIXME: renderer 在 Composition 下
  const renderer = composition.renderer;

  const tex = Texture.create(
    renderer.engine,
    {
      sourceType: TextureSourceType.framebuffer,
    });
  const filterParams = [0, 0.96, 0, 0];

  const textureFilter = renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const delayPass = new DelayPass(renderer, {
    name: 'delayCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  return {
    mesh: {
      fragment: delayFrag,
      shaderCacheId: 'delay',
      uniformValues: {
        uLastSource: tex,
      },
      variables: {
        uParams: () => filterParams,
      },
      materialStates: {
        blending: true,
        blendFunction: [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA],
        depthTest: false,
        culling: false,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [delayPass],
    },
    onItemRemoved () {
      tex.dispose();
    },
    renderPassDelegate: {
      didEndRenderPass (pass: RenderPass) {
        // @ts-expect-error
        renderer.extension.copyTexture(pass.attachments[0].texture, tex);
        filterParams[0] = 2;
      },
    },
  };
}

