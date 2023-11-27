import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/index';
import type { Composition } from '../composition';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import { nearestPowerOfTwo } from '../math';
import type { PluginSystem } from '../plugin-system';
import type { RenderPassDestroyOptions, RenderPassOptions, Renderer } from '../render';
import { FrameBuffer, RenderPass, RenderPassAttachmentStorageType, RenderTargetHandle, getTextureSize } from '../render';
import { copyFrag } from '../shader';
import { Texture, TextureLoadAction, TextureSourceType } from '../texture';
import { cloneSpriteMesh } from './utils';

/****************************************************************************************/
/** 高斯滤镜，分3个 pass 组成，分别是高斯 H、高斯 V 和最终合并两个 pass 结果的 copyPass **********/
/****************************************************************************************/

class GaussianPass extends RenderPass {
  uTexStep: Vector2;
  uBlurSource: Texture;
  prePassTexture: Texture;
  preDefaultPassTexture: Texture;
  pluginSystem: PluginSystem;
  fragShader: string;
  type: 'H' | 'V'; // 高斯模糊的方向，可选'V'和'H'
  preDefaultPassAttachment: RenderTargetHandle; // 滤镜前的 pass attachment

  mframeBuffer: FrameBuffer;

  constructor (renderer: Renderer, type: 'H' | 'V', uTexStep: Vector2, pluginSystem: PluginSystem, fragShader: string, option: RenderPassOptions) {
    super(renderer, option);
    this.uTexStep = uTexStep;
    this.pluginSystem = pluginSystem;
    this.fragShader = fragShader;
    this.type = type;
  }

  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()![0] ? renderer.getFrameBuffer()!.getColorTextures()![0] : renderer.renderingData.currentFrame.transparentTexture;
    if (this.type === 'H') {
      this.preDefaultPassAttachment.texture = this.prePassTexture;
    }
    this.preDefaultPassTexture = this.preDefaultPassAttachment.texture;

    if (!this.mframeBuffer) {
      const attachment = Texture.create(renderer.engine, {
        sourceType: TextureSourceType.framebuffer,
        minFilter: glContext.LINEAR,
        magFilter: glContext.LINEAR,
        name: this.type,
        internalFormat: glContext.RGBA,
        format: glContext.RGBA,
        type: glContext.UNSIGNED_BYTE,
      });

      this.mframeBuffer = FrameBuffer.create({
        name: this.type,
        storeAction: {},
        viewport: this.viewport,
        viewportScale: 1,
        isCustomViewport: true,
        attachments: [attachment],
        depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.none },
      }, renderer);
    }

    renderer.setFrameBuffer(this.mframeBuffer);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[0].material.setTexture('uFilterSource', this.preDefaultPassTexture);
    this.meshes[0].material.setVector2('uFilterSourceSize', getTextureSize(this.preDefaultPassTexture));
    this.meshes[1].material.setVector2('uTexStep', this.uTexStep);
    this.meshes[1].material.setTexture('uBlurSource', this.uBlurSource ? this.uBlurSource : this.prePassTexture);
    this.meshes[1].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uSamplerPre', this.preDefaultPassTexture);
    this.meshes[1].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    const renderQueue = [this.meshes[0], cloneSpriteMesh(renderer.engine, this.meshes[1], { fragment: this.fragShader })];

    renderer.renderMeshes(renderQueue);
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    super.dispose(options);
    const mframeBuffer = this.mframeBuffer;

    if (mframeBuffer) {
      mframeBuffer.dispose(options);
    }
  }
}

/**
 * 滤镜元素的最终渲染 Pass
 */
export class CopyPass extends RenderPass {
  // 滤镜前的 pass attachment
  preDefaultPassAttachment: RenderTargetHandle;
  prePassTexture: Texture;

  constructor (renderer: Renderer, options: RenderPassOptions, preDefaultPassAttachment?: RenderTargetHandle) {
    super(renderer, options);
    if (preDefaultPassAttachment) {
      this.preDefaultPassAttachment = preDefaultPassAttachment;
    }
  }

  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()![0];
    if (!this.preDefaultPassAttachment) {
      this.preDefaultPassAttachment = new RenderTargetHandle(renderer.engine, {});
      this.preDefaultPassAttachment.texture = this.prePassTexture;
    }

    renderer.setFrameBuffer(this.frameBuffer!);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[0].material.setTexture('uFilterSource', this.preDefaultPassAttachment.texture);
    this.meshes[0].material.setVector2('uFilterSourceSize', getTextureSize(this.preDefaultPassAttachment.texture));
    this.meshes[1].material.setTexture('uFrameSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uSamplerPre', this.preDefaultPassAttachment.texture);
    this.meshes[1].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    const renderQueue = [this.meshes[0], this.meshes[1]];

    renderer.renderMeshes(renderQueue);
  }
}

export function createGaussianShader (filter: spec.FilterParams): FilterShaderDefine[] {
  const { radius } = filter as spec.GaussianFilterParams;
  const f = gaussianFilter({ radius });

  return [
    {
      fragment: copyFrag,
      shaderCacheId: `gaussian-${f.step}`,
    },
    {
      fragment: f.shader,
      ignoreBlend: true,
    },
  ];
}

export function registerGaussianFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const { radius } = filter as spec.GaussianFilterParams;
  const { level } = composition.getEngine().gpuCapability;
  const engine = composition.renderer.engine;
  const renderer = composition.renderer;
  const { downSample, step, shader } = gaussianFilter({ radius });
  let texWidth = Math.round(composition.width / downSample);
  let texHeight = Math.round(composition.height / downSample);

  if (level === 1) {
    texHeight = nearestPowerOfTwo(texHeight);
    texWidth = nearestPowerOfTwo(texWidth);
  }
  const viewport: spec.vec4 = [0, 0, texWidth, texHeight];
  const gaussianTextureV = composition.renderFrame.passTextureCache.requestColorAttachmentTexture({
    minFilter: glContext.LINEAR,
    magFilter: glContext.LINEAR,
    name: 'gaussianV',
    width: texWidth,
    height: texHeight,
  });
  const gaussianTextureH = composition.renderFrame.passTextureCache.requestColorAttachmentTexture({
    minFilter: glContext.LINEAR,
    magFilter: glContext.LINEAR,
    name: 'gaussianH',
    width: texWidth,
    height: texHeight,
  });

  // 使用一个attachment对象保存滤镜前的pass渲染结果，传递到后续滤镜pass使用
  const preDefaultPassColorAttachment = new RenderTargetHandle(engine, {});
  const gaussianHPass = new GaussianPass(renderer, 'H', new Vector2(0, step), composition.pluginSystem, shader, {
    name: 'gaussianH',
    viewport,
    attachments: [{ texture: gaussianTextureH }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  gaussianHPass.preDefaultPassAttachment = preDefaultPassColorAttachment;
  const gaussianVPass = new GaussianPass(renderer, 'V', new Vector2(step, 0), composition.pluginSystem, shader, {
    name: 'gaussianV',
    viewport,
    attachments: [{ texture: gaussianTextureV }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  gaussianVPass.preDefaultPassAttachment = preDefaultPassColorAttachment;
  const texturefilter = level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const copyPass = new CopyPass(renderer, {
    name: 'gaussianCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: texturefilter, magFilter: texturefilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  }, preDefaultPassColorAttachment);

  copyPass.preDefaultPassAttachment = preDefaultPassColorAttachment;

  return {
    mesh: {
      fragment: copyFrag,
      shaderCacheId: `gaussian-${step}`,
      uniformValues: {
        uTexSize: [texWidth, texHeight],
      },
      materialStates: {
        blending: false,
        culling: false,
      },
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [gaussianHPass, gaussianVPass, copyPass],
    },
  };
}

export function gaussianFilter (opts: { radius: number, maxStep?: number }) {
  let downSample = opts.radius <= 3 ? 1 : 2;
  let radius = opts.radius / downSample;
  const maxStep = opts.maxStep || 4;

  while (radius > 10 && downSample < maxStep) {
    downSample *= 2;
    radius = opts.radius / downSample;
  }
  const step = 1 + (opts.radius % downSample) / downSample / downSample;

  radius = Math.floor(radius);
  const floats = getGaussianParams(radius);
  const steps = [];

  for (let i = -radius; i <= radius; i++) {
    const weight = floats[i + radius];

    steps.push(`color += texture2D(uBlurSource,getTexCoord(${i.toFixed(1)})) * ${weight};`);
  }
  const ret = {
    shader: `
  uniform sampler2D uBlurSource;
  uniform vec2 uTexSize;
  uniform vec2 uTexStep;
  #define getTexCoord(i) coord + uTexStep/uTexSize * i
  vec4 filterMain(vec2 coord,sampler2D tex){
    vec4 color = vec4(0.);
    vec2 texCoord;
    ${steps.join('\n')}

    return color;
  }
  `,
    step: step,
    downSample: downSample,
    radius,
  };

  if (__DEBUG__) {
    console.debug('gaussian down sample:', ret.downSample, 'radius:', ret.radius, 'step:' + ret.step);
  }

  return ret;
}

function calculateSigma (x: number, sig: number) {
  return Math.exp(-(x * x) / (2 * sig * sig)) / Math.sqrt(2 * Math.PI) / sig;
}

function getGaussianParams (radius: number): number[] {
  const sigma = (radius + 1) / 3.329;
  const nums: number[] = [];

  for (let i = -radius; i <= radius; i++) {
    nums.push(calculateSigma(i, sigma));
  }

  return nums;
}
