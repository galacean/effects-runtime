import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { vec4 } from '@galacean/effects-specification';
import type { Camera } from '../camera';
import type { PostProcessVolume, RendererComponent } from '../components';
import { glContext } from '../gl';
import type { UniformValue } from '../material';
import { PassTextureCache } from '../paas-texture-cache';
import type { Texture } from '../texture';
import { TextureLoadAction } from '../texture';
import type { Disposable } from '../utils';
import { DestroyOptions, removeItem } from '../utils';
import { createCopyShader } from './create-copy-shader';
import { DrawObjectPass } from './draw-object-pass';
import type { Mesh } from './mesh';
import { BloomThresholdPass, HQGaussianDownSamplePass, HQGaussianUpSamplePass, ToneMappingPass } from './post-process-pass';
import type { RenderPass, RenderPassClearAction, RenderPassColorAttachmentOptions, RenderPassDepthStencilAttachment, RenderPassDestroyOptions, RenderPassStoreAction } from './render-pass';
import { RenderPassAttachmentStorageType, RenderTargetHandle } from './render-pass';
import type { Renderer } from './renderer';
import type { SemanticFunc } from './semantic-map';
import { SemanticMap } from './semantic-map';

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
 * RenderPass 信息，记录了 RenderFrame 中 RenderPass 的信息
 */
export interface RenderPassInfo {
  /**
   * 内部包含 Mesh 中最小优先级
   */
  listStart: number,
  /**
   * 内部包含 Mesh 中最大优先级
   */
  listEnd: number,
  /**
   * 是否绑定 Framebuffer 对象
   */
  intermedia: boolean,
  /**
   * RenderPass 对象
   */
  renderPass: RenderPass,
  /**
   * 前面的 RenderPass 对象数组
   */
  prePasses?: { pass: RenderPass, destroyOptions?: RenderPassDestroyOptions | boolean }[],
  /**
   * 前一个 RenderPass 对象
   */
  preRenderPass?: RenderPass,
}

/**
 * RenderFrame 内部保存的多 Pass 相关资源
 */
export interface RenderFrameResource {
  /**
   * 纹理对象，用于 Framebuffer 的颜色 Attachment
   */
  color_a: Texture,
  /**
   * 纹理对象，用于 Framebuffer 的颜色 Attachment
   */
  color_b: Texture,
  /**
   * 拷贝 RenderPass 对象，将前 RenderPass 的渲染结果拷贝到硬件帧缓存中
   */
  finalCopyRP: RenderPass,
  /**
   * 资源 RenderPass 对象，为临时生成的 RenderPass 提供 Attachment 资源
   */
  resRP: RenderPass,
  /**
   * 深度和蒙版，为临时生成的 RenderPass 提供 Attachment 资源
   */
  depthStencil?: RenderPassDepthStencilAttachment,
}

/**
 * RenderPass 切分时的参数
 */
export interface RenderPassSplitOptions {
  attachments?: RenderPassColorAttachmentOptions[],
  storeAction?: RenderPassStoreAction,
  prePasses?: RenderPass[],
}

export const RENDER_PASS_NAME_PREFIX = '_effects_default_';

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
   * RenderFrame 范围内共用的 Shader Uniform 变量，
   * 以及多 Pass 渲染时 ColorAttachment 关联到后面的 Shader Uniform 上
   */
  semantics?: Record<string, UniformValue | SemanticFunc>,
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
  /**
   * 公用 Uniform 变量表
   */
  readonly semantics: SemanticMap;
  readonly globalUniforms: GlobalUniforms;

  protected destroyed = false;
  protected renderPassInfoMap: WeakMap<RenderPass, RenderPassInfo> = new WeakMap();

  private drawObjectPass: RenderPass;

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
    this.globalUniforms = new GlobalUniforms();
    let attachments: RenderPassColorAttachmentOptions[] = [];  //渲染场景物体Pass的RT
    let depthStencilAttachment;

    this.renderer = renderer;
    if (postProcessingEnabled) {
      const enableHDR = true;

      if (!this.renderer.engine.gpuCapability.detail.halfFloatTexture) {
        throw new Error('Half float texture is not supported.');
      }

      // 使用HDR浮点纹理，FLOAT在IOS上报错，使用HALF_FLOAT
      const textureType = enableHDR ? glContext.HALF_FLOAT : glContext.UNSIGNED_BYTE;

      attachments = [{ texture: { format: glContext.RGBA, type: textureType, magFilter: glContext.LINEAR, minFilter: glContext.LINEAR } }];
      depthStencilAttachment = { storageType: RenderPassAttachmentStorageType.depth_stencil_opaque };
    }

    this.drawObjectPass = new DrawObjectPass(renderer, {
      name: RENDER_PASS_NAME_PREFIX,
      depthStencilAttachment,
      attachments,
    });

    const renderPasses = [this.drawObjectPass];

    this.setRenderPasses(renderPasses);

    if (postProcessingEnabled) {
      const sceneTextureHandle = new RenderTargetHandle(engine);  //保存后处理前的屏幕图像

      const gaussianStep = 7; // 高斯模糊的迭代次数，次数越高模糊范围越大
      const viewport: vec4 = [0, 0, this.renderer.getWidth() / 2, this.renderer.getHeight() / 2];

      const gaussianDownResults = new Array<RenderTargetHandle>(gaussianStep);  //存放多个高斯Pass的模糊结果，用于Bloom
      const enableHDR = true;
      const textureType = enableHDR ? glContext.HALF_FLOAT : glContext.UNSIGNED_BYTE;
      const bloomThresholdPass = new BloomThresholdPass(renderer, {
        name: 'BloomThresholdPass',
        attachments: [{
          texture: {
            format: glContext.RGBA,
            type: textureType,
            minFilter: glContext.LINEAR,
            magFilter: glContext.LINEAR,
          },
        }],
      });

      bloomThresholdPass.sceneTextureHandle = sceneTextureHandle;
      this.addRenderPass(bloomThresholdPass);
      for (let i = 0; i < gaussianStep; i++) {
        gaussianDownResults[i] = new RenderTargetHandle(engine);
        const gaussianDownHPass = new HQGaussianDownSamplePass(renderer, 'H', i, {
          name: 'GaussianDownPassH' + i,
          attachments: [{
            texture: {
              format: glContext.RGBA,
              type: textureType,
              minFilter: glContext.LINEAR,
              magFilter: glContext.LINEAR,
            },
          }],
        });

        const gaussianDownVPass = new HQGaussianDownSamplePass(renderer, 'V', i, {
          name: 'GaussianDownPassV' + i,
          attachments: [{
            texture: {
              format: glContext.RGBA,
              type: textureType,
              minFilter: glContext.LINEAR,
              magFilter: glContext.LINEAR,
            },
          }],
        });

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
        const gaussianUpPass = new HQGaussianUpSamplePass(renderer, gaussianStep - i, {
          name: 'GaussianUpPass' + i,
          attachments: [{
            texture: {
              format: glContext.RGBA,
              type: textureType,
              minFilter: glContext.LINEAR,
              magFilter: glContext.LINEAR,
            },
          }],
        });

        gaussianUpPass.gaussianDownSampleResult = gaussianDownResults[gaussianStep - 2 - i];
        this.addRenderPass(gaussianUpPass);
        viewport[2] *= 2;
        viewport[3] *= 2;
      }
      const postProcessPass = new ToneMappingPass(renderer, sceneTextureHandle);

      this.addRenderPass(postProcessPass);
    }

    this.semantics = new SemanticMap(options.semantics);
    this.clearAction = clearAction;
    this.name = `RenderFrame${seed++}`;

    const firstRP = renderPasses[0];

    this.camera = camera;
    this.keepColorBuffer = keepColorBuffer;
    this.renderPassInfoMap.set(firstRP, { listStart: 0, listEnd: 0, renderPass: firstRP, intermedia: false });
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

  get isDestroyed () {
    return this.destroyed;
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
    if (options?.semantics !== DestroyOptions.keep) {
      this.semantics.dispose();
    }
    const pass = options?.passes ? options.passes : undefined;

    if (pass !== DestroyOptions.keep) {
      this._renderPasses.forEach(renderPass => {
        renderPass.dispose(pass);
      });
    }
    this.passTextureCache.dispose();
    this._renderPasses.length = 0;
    this.destroyed = true;
  }

  /**
   * 查找 Mesh 所在的 RenderPass 索引，没找到是-1
   * @param mesh - 需要查找的 Mesh
   */
  findMeshRenderPassIndex (mesh: Mesh): number {
    let index = -1;

    this.renderPasses.every((rp, idx) => {
      if (rp.name.startsWith(RENDER_PASS_NAME_PREFIX) && rp.meshes.includes(mesh)) {
        index = idx;

        return false;
      }

      return true;
    });

    return index;
  }

  protected addToRenderPass (renderPass: RenderPass, mesh: Mesh) {
    const info = this.renderPassInfoMap.get(renderPass);
    const { priority } = mesh;

    if (!info) {
      return;
    }

    if (renderPass.meshes.length === 0) {
      info.listStart = info.listEnd = priority;
    } else {
      if (priority < info.listStart) {
        info.listStart = priority;
      } else if (priority > info.listEnd) {
        info.listEnd = priority;
      }
    }
    renderPass.addMesh(mesh);
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
    if (this.renderer !== undefined) {
      passes.forEach(pass => (pass as unknown as RenderPass).initialize(this.renderer));
    }
    this._renderPasses = passes.slice();
  }

  /**
   * 添加 RenderPass
   * @param pass - 需要添加的 RenderPass
   */
  addRenderPass (pass: RenderPass): void {
    if (this.renderer !== undefined) {
      pass.initialize(this.renderer);
    }
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
