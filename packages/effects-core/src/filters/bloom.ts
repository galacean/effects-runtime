import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/index';
import type { Composition } from '../composition';
import type { FilterDefine, FilterShaderDefine } from '../filter';
import { glContext } from '../gl';
import type { ValueGetter } from '../math';
import { createValueGetter, nearestPowerOfTwo } from '../math';
import type { PluginSystem } from '../plugin-system';
import type { Renderer, RenderPassOptions } from '../render';
import { getTextureSize, RenderPass, RenderTargetHandle } from '../render';
import { bloomMixVert, bloomThresholdVert } from '../shader';
import type { Texture } from '../texture';
import { TextureLoadAction } from '../texture';
import { gaussianFilter } from './gaussian';
import { cloneSpriteMesh } from './utils';

/******************************************************************************************/
/** Bloom 滤镜，分4个 pass 组成，分别是阈值 Pass、高斯 H、高斯 V 和最终合并 pass 结果的 copyPass ***/
/******************************************************************************************/

export function createBloomShader (filter: spec.FilterParams): FilterShaderDefine[] {
  const { radius = 30 } = filter as spec.BloomFilterPrams;
  const gaussian = gaussianFilter({ radius });

  return [
    {
      fragment: bloomMixVert,
      shaderCacheId: `bloom-${gaussian.step}`,
    },
    { fragment: bloomThresholdVert, ignoreBlend: true },
    { fragment: gaussian.shader, ignoreBlend: true },
  ];
}

export function registerBloomFilter (filter: spec.FilterParams, composition: Composition): FilterDefine {
  const {
    radius = 30,
    bloomAddon = 0.4,
    colorAddon = 1,
    colorThreshold = [255, 255, 255],
  } = filter as spec.BloomFilterPrams;
  const { level } = composition.getEngine().gpuCapability;
  const gaussian = gaussianFilter({ radius });
  const engine = composition.renderer.engine;
  const renderer = composition.renderer;
  let width = Math.round(composition.width / gaussian.downSample);
  let height = Math.round(composition.width / gaussian.downSample);

  if (level === 1) {
    width = nearestPowerOfTwo(width);
    height = nearestPowerOfTwo(height);
  }
  const viewport: spec.vec4 = [0, 0, width, height];

  // TODO 这里设置的width和height没用，会被viewport覆盖
  const blurTarget = composition.renderFrame.passTextureCache.requestColorAttachmentTexture({
    format: glContext.RGBA,
    magFilter: glContext.LINEAR,
    minFilter: glContext.LINEAR,
    name: 'gaussianV',
    width, height,
  });
  const blurInterMedia = composition.renderFrame.passTextureCache.requestColorAttachmentTexture({
    format: glContext.RGBA,
    magFilter: glContext.LINEAR,
    minFilter: glContext.LINEAR,
    name: 'gaussianH',
    width, height,
  });
  const bloomAddOnGetter: ValueGetter<number> = createValueGetter(bloomAddon);
  const colorAddOnGetter: ValueGetter<number> = createValueGetter(colorAddon);

  const preDefaultPassColorAttachment = new RenderTargetHandle(engine);
  const thresholdPass = new ThresholdPass(renderer, {
    name: 'threshold',
    attachments: [{ texture: blurTarget }],
    viewport,
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  });

  thresholdPass.pluginSystem = composition.pluginSystem;
  thresholdPass.fragShader = bloomThresholdVert;
  thresholdPass.preDefaultPassAttachment = preDefaultPassColorAttachment;

  const gaussianHPass = new BloomGaussianPass(renderer, 'H', new Vector2(gaussian.step, 0), composition.pluginSystem, gaussian.shader, {
    name: 'gaussianH',
    viewport,
    attachments: [{ texture: blurInterMedia }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  }, blurTarget);

  gaussianHPass.preDefaultPassAttachment = preDefaultPassColorAttachment;
  const gaussianVPass = new BloomGaussianPass(renderer, 'V', new Vector2(0, gaussian.step), composition.pluginSystem, gaussian.shader, {
    name: 'gaussianV',
    viewport,
    attachments: [{ texture: blurTarget }],
  }, blurInterMedia);

  gaussianVPass.preDefaultPassAttachment = preDefaultPassColorAttachment;

  const textureFilter = level === 2 ? glContext.LINEAR : glContext.NEAREST;
  const copyPass = new BloomCopyPass(renderer, {
    name: 'bloomCopyPass',
    attachments: [{ texture: { format: glContext.RGBA, minFilter: textureFilter, magFilter: textureFilter } }],
    clearAction: {
      colorAction: TextureLoadAction.clear,
    },
  }, preDefaultPassColorAttachment);

  return {
    mesh: {
      name: `bloom-${gaussian.step}`,
      fragment: bloomMixVert,
      shaderCacheId: `bloom-${gaussian.step}`,
      variables: {
        uBloomParams: life => [
          bloomAddOnGetter.getValue(life),
          colorAddOnGetter.getValue(life),
          0,
          1,
        ],
      },
      uniformValues: {
        uColorThreshold: [(colorThreshold[0] / 255) || 1.1, (colorThreshold[1] / 255) || 1.1, (colorThreshold[2] / 255) || 1.1, 0],
        uBloomBlur: blurTarget,
      },
      materialStates: {
        blending: false,
        culling: false,
      },
    },
    onItemRemoved () {
      blurTarget.dispose();
      blurInterMedia.dispose();
    },
    passSplitOptions: {
      attachments: [{ texture: { format: glContext.RGBA } }],
      prePasses: [thresholdPass, gaussianHPass, gaussianVPass, copyPass],
    },
  };
}

class ThresholdPass extends RenderPass {
  pluginSystem: PluginSystem;
  fragShader: string;
  preDefaultPassAttachment: RenderTargetHandle; // 滤镜前的pass attachment

  constructor (renderer: Renderer, option: RenderPassOptions) {
    super(renderer, option);
  }

  override configure (renderer: Renderer): void {
    const currentFrameBuffer = renderer.getFrameBuffer();

    // 第一个Pass，可能前一个pass没有FBO需要判断一下。
    this.preDefaultPassAttachment.texture = currentFrameBuffer ? currentFrameBuffer.getColorTextures()[0] : renderer.renderingData.currentFrame.transparentTexture;
    renderer.setFrameBuffer(this.frameBuffer!);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[1].material.setTexture('uSamplerPre', this.preDefaultPassAttachment.texture);
    this.meshes[1].material.setVector2('uTexSize', getTextureSize(this.preDefaultPassAttachment.texture));
    const renderQueue = [cloneSpriteMesh(renderer.engine, this.meshes[1], { fragment: this.fragShader })];

    renderer.renderMeshes(renderQueue);
  }
}

class BloomGaussianPass extends RenderPass {
  uTexStep: Vector2;
  uBlurSource: Texture;
  prePassTexture: Texture;
  preDefaultPassTexture: Texture;
  pluginSystem: PluginSystem;
  fragShader: string;
  type: 'H' | 'V'; //高斯模糊的方向 可选'V'和'H'
  preDefaultPassAttachment: RenderTargetHandle; // 滤镜前的pass attachment

  constructor (renderer: Renderer, type: 'H' | 'V', uTexStep: Vector2, pluginSystem: PluginSystem, fragShader: string,
    option: RenderPassOptions, uBlurSource?: Texture) {
    super(renderer, option);
    this.uTexStep = uTexStep;
    this.pluginSystem = pluginSystem;
    this.fragShader = fragShader;
    this.type = type;
    if (uBlurSource) {
      this.uBlurSource = uBlurSource;
    }
  }

  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()[0];
    this.preDefaultPassTexture = this.preDefaultPassAttachment.texture;
    renderer.setFrameBuffer(this.frameBuffer!);
    if (!this.uBlurSource) {
      this.uBlurSource = this.prePassTexture;
    }
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[1].material.setVector2('uTexStep', this.uTexStep);
    this.meshes[1].material.setTexture('uBlurSource', this.uBlurSource);
    this.meshes[1].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uSamplerPre', this.preDefaultPassTexture);
    this.meshes[1].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    this.meshes[1].material.setVector2('uTexSize', getTextureSize(this.uBlurSource));
    const renderQueue = [cloneSpriteMesh(renderer.engine, this.meshes[1], { fragment: this.fragShader })];

    renderer.renderMeshes(renderQueue);
  }
}

/**
 * Bloom 滤镜元素的最终渲染 Pass
 */
class BloomCopyPass extends RenderPass {
  // 滤镜前的pass attachment
  preDefaultPassAttachment: RenderTargetHandle;
  prePassTexture: Texture;

  constructor (renderer: Renderer, options: RenderPassOptions, preDefaultPassAttachment: RenderTargetHandle) {
    super(renderer, options);
    this.preDefaultPassAttachment = preDefaultPassAttachment;
  }

  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()[0];

    renderer.setFrameBuffer(this.frameBuffer!);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[0].material.setTexture('uFilterSource', this.preDefaultPassAttachment.texture);
    this.meshes[0].material.setVector2('uFilterSourceSize', getTextureSize(this.preDefaultPassAttachment.texture));
    this.meshes[1].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[1].material.setTexture('uSamplerPre', this.preDefaultPassAttachment.texture);
    this.meshes[1].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    this.meshes[1].material.setVector2('uTexSize', getTextureSize(this.preDefaultPassAttachment.texture));
    const renderQueue = [this.meshes[0], this.meshes[1]];

    renderer.renderMeshes(renderQueue);
  }
}
