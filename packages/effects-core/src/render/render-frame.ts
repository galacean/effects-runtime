import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { vec4 } from '@galacean/effects-specification';
import type { Camera } from '../camera';
import type { PostProcessVolume, RendererComponent } from '../components';
import { PassTextureCache } from '../paas-texture-cache';
import type { Texture } from '../texture';
import { TextureLoadAction } from '../texture';
import type { Disposable } from '../utils';
import { DestroyOptions, removeItem } from '../utils';
import { createCopyShader } from './create-copy-shader';
import { DrawObjectPass } from './draw-object-pass';
import { BloomThresholdPass, HQGaussianDownSamplePass, HQGaussianUpSamplePass, ToneMappingPass } from './post-process-pass';
import type { RenderPass, RenderPassClearAction, RenderPassDestroyOptions } from './render-pass';
import { RenderTargetHandle } from './render-pass';
import type { Renderer } from './renderer';

/**
 * 渲染数据，保存了当前渲染使用到的数据。
 */
export interface RenderingData {
  /**
   * 当前渲染使用的 Camera
   */
  currentCamera: Camera,
  /**
   * 当前渲染的 RenderFrame
   */
  currentFrame: RenderFrame,
  /**
   * 当前渲染的 RenderPass
   */
  currentPass: RenderPass,
}

/**
 * 抽象 RenderFrame 选项
 */
export interface RenderFrameOptions {
  camera: Camera,
  /**
   * 编辑器整体变换，Player 开发不需要关注
   */
  editorTransform?: vec4,
  /**
   * 是否每次渲染时清除 RenderFrame 颜色缓存
   */
  keepColorBuffer?: boolean,
  /**
   * 渲染视口大小
   */
  viewport?: vec4,
  /**
   * 每个 RenderPass 使用前进行的 Clear 操作
   */
  clearAction?: RenderPassClearAction,
  /**
   * 后处理渲染配置
   */
  globalVolume?: PostProcessVolume,
  /**
   * 后处理是否开启
   */
  postProcessingEnabled?: boolean,
  /**
   * 名称
   */
  name?: string,
  renderer: Renderer,
}

export type RenderFrameDestroyOptions = {
  passes?: RenderPassDestroyOptions | DestroyOptions.keep,
  semantics?: DestroyOptions,
};

let seed = 1;

/**
 * RenderFrame 抽象类
 */
export class RenderFrame implements Disposable {
  /**
   * 当前使用的全部 RenderPass
   */
  _renderPasses: RenderPass[];
  /**
   * RenderPass 清除帧缓存操作
   */
  clearAction: RenderPassClearAction;
  /**
   * 滤镜中 RenderPass 用到的纹理缓存器
   */
  passTextureCache: PassTextureCache;
  /**
   * 渲染时的相机
   */
  camera: Camera;
  /**
   * Composition中用到的所有纹理缓存
   */
  cachedTextures: Texture[];
  /**
   * 存放后处理的属性设置
   */
  globalVolume?: PostProcessVolume;
  renderer: Renderer;
  keepColorBuffer?: boolean;
  editorTransform: Vector4;

  // TODO: 是否有用
  renderQueue: RendererComponent[] = [];

  /**
   * 名称
   */
  readonly name: string;
  readonly globalUniforms: GlobalUniforms;

  private disposed = false;
  private drawObjectPass: DrawObjectPass;
  private postProcessingEnabled: boolean = false;
  private enableHDR: boolean = true;

  constructor (options: RenderFrameOptions) {
    const {
      camera, keepColorBuffer, renderer,
      editorTransform = [1, 1, 0, 0],
      globalVolume,
      postProcessingEnabled = false,
      clearAction = {
        colorAction: TextureLoadAction.whatever,
        stencilAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.whatever,
      },
    } = options;
    const engine = renderer.engine;

    if (globalVolume) {
      this.globalVolume = globalVolume;
    }

    this.postProcessingEnabled = postProcessingEnabled;
    this.globalUniforms = new GlobalUniforms();
    this.renderer = renderer;

    if (postProcessingEnabled && this.enableHDR && !this.renderer.engine.gpuCapability.detail.halfFloatTexture) {
      throw new Error('Half float texture is not supported.');
    }

    this.drawObjectPass = new DrawObjectPass(renderer);
    const renderPasses = [this.drawObjectPass];

    this.setRenderPasses(renderPasses);

    if (postProcessingEnabled) {
      const sceneTextureHandle = new RenderTargetHandle(engine);  //保存后处理前的屏幕图像

      const gaussianStep = 7; // 高斯模糊的迭代次数，次数越高模糊范围越大
      const viewport: vec4 = [0, 0, this.renderer.getWidth() / 2, this.renderer.getHeight() / 2];

      const gaussianDownResults = new Array<RenderTargetHandle>(gaussianStep);  //存放多个高斯Pass的模糊结果，用于Bloom
      const bloomThresholdPass = new BloomThresholdPass(renderer);

      bloomThresholdPass.sceneTextureHandle = sceneTextureHandle;
      this.addRenderPass(bloomThresholdPass);
      for (let i = 0; i < gaussianStep; i++) {
        gaussianDownResults[i] = new RenderTargetHandle(engine);
        const gaussianDownHPass = new HQGaussianDownSamplePass(renderer, 'H', i);
        const gaussianDownVPass = new HQGaussianDownSamplePass(renderer, 'V', i);

        gaussianDownVPass.gaussianResult = gaussianDownResults[i];

        this.addRenderPass(gaussianDownHPass);
        this.addRenderPass(gaussianDownVPass);
        viewport[2] /= 2;
        viewport[3] /= 2;
        // TODO 限制最大迭代
      }
      viewport[2] *= 4;
      viewport[3] *= 4;
      for (let i = 0; i < gaussianStep - 1; i++) {
        const gaussianUpPass = new HQGaussianUpSamplePass(renderer, gaussianStep - i);

        gaussianUpPass.gaussianDownSampleResult = gaussianDownResults[gaussianStep - 2 - i];
        this.addRenderPass(gaussianUpPass);
        viewport[2] *= 2;
        viewport[3] *= 2;
      }
      const postProcessPass = new ToneMappingPass(renderer, sceneTextureHandle);

      this.addRenderPass(postProcessPass);
    }

    this.clearAction = clearAction;
    this.name = `RenderFrame${seed++}`;

    this.camera = camera;
    this.keepColorBuffer = keepColorBuffer;
    this.editorTransform = Vector4.fromArray(editorTransform);

    if (!options.clearAction) {
      this.resetClearActions();
    }

    this.passTextureCache = new PassTextureCache(engine);

    // FIXME: addShader是为了性能考虑，如果影响不大，下面代码可以删除
    const { detail, level } = engine.gpuCapability;
    const writeDepth = detail.readableDepthStencilTextures && detail.writableFragDepth;
    const shader = createCopyShader(level, writeDepth);

    this.renderer.getShaderLibrary()?.addShader(shader);
  }

  get renderPasses () {
    return this._renderPasses.slice();
  }

  get isDisposed () {
    return this.disposed;
  }

  /**
   * 设置 RenderPasses 参数，此函数每帧调用一次
   */
  setup () {
    this.drawObjectPass.setup(this.postProcessingEnabled);
  }

  /**
   * 根据 Mesh 优先级添加到 RenderPass
   * @param mesh - 要添加的 Mesh 对象
   */
  addMeshToDefaultRenderPass (mesh: RendererComponent) {
    this.drawObjectPass.addMesh(mesh);
  }

  /**
   * 把 Mesh 从 RenderPass 中移除，
   * 如果 renderPass 中没有 mesh，此 renderPass 会被删除
   * @param mesh - 要删除的 Mesh 对象
   */
  removeMeshFromDefaultRenderPass (mesh: RendererComponent) {
    this.drawObjectPass.removeMesh(mesh);
  }

  /**
   * 销毁 RenderFrame
   * @param options - 可以有选择销毁一些对象
   */
  dispose (options?: RenderFrameDestroyOptions) {
    const pass = options?.passes ? options.passes : undefined;

    if (pass !== DestroyOptions.keep) {
      this._renderPasses.forEach(renderPass => {
        renderPass.dispose(pass);
      });
    }
    this.passTextureCache.dispose();
    this._renderPasses.length = 0;
    this.disposed = true;
  }

  protected resetClearActions () {
    const action = this.renderPasses.length > 1 ? TextureLoadAction.clear : TextureLoadAction.whatever;

    this.clearAction.stencilAction = action;
    this.clearAction.depthAction = action;
    this.clearAction.colorAction = action;
    if (this.keepColorBuffer) {
      this.clearAction.colorAction = TextureLoadAction.whatever;
    }
  }

  /**
   * 设置 RenderPass 数组，直接修改内部的 RenderPass 数组
   * @param passes - RenderPass 数组
   */
  setRenderPasses (passes: RenderPass[]) {
    this._renderPasses = passes.slice();
  }

  /**
   * 添加 RenderPass
   * @param pass - 需要添加的 RenderPass
   */
  addRenderPass (pass: RenderPass): void {
    this._renderPasses.push(pass);
  }

  /**
   * 移除 RenderPass
   * @param pass - 需要移除的 RenderPass
   */
  removeRenderPass (pass: RenderPass): void {
    removeItem(this._renderPasses, pass);
  }
}

export function getTextureSize (tex?: Texture): Vector2 {
  return tex ? new Vector2(tex.getWidth(), tex.getHeight()) : new Vector2();
}

export function findPreviousRenderPass (renderPasses: RenderPass[], renderPass: RenderPass): RenderPass | undefined {
  const index = renderPasses.indexOf(renderPass);

  return renderPasses[index - 1];
}

export class GlobalUniforms {
  floats: Record<string, number> = {};
  ints: Record<string, number> = {};
  vector3s: Record<string, Vector3> = {};
  vector4s: Record<string, Vector4> = {};
  matrices: Record<string, Matrix4> = {};
  //...

  samplers: string[] = [];  // 存放的sampler名称。
  uniforms: string[] = [];  // 存放的uniform名称（不包括sampler）。
}
