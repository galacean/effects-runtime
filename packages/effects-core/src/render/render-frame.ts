import type { vec4 } from '@galacean/effects-specification';
import type { Matrix4 } from '@galacean/effects-math/es/core/index';
import { Vector2, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Camera } from '../camera';
import { glContext } from '../gl';
import type { UniformValue } from '../material';
import { Material } from '../material';
import { PassTextureCache } from '../paas-texture-cache';
import type { SemanticFunc } from '../semantic-map';
import { SemanticMap } from '../semantic-map';
import { Texture, TextureLoadAction, TextureSourceType } from '../texture';
import type { Disposable } from '../utils';
import { DestroyOptions, OrderType, removeItem } from '../utils';
import { createCopyShader, EFFECTS_COPY_MESH_NAME } from './create-copy-shader';
import { Geometry } from './geometry';
import { Mesh } from './mesh';
import type { RenderPassClearAction, RenderPassColorAttachmentOptions, RenderPassColorAttachmentTextureOptions, RenderPassDepthStencilAttachment, RenderPassDestroyOptions, RenderPassStoreAction } from './render-pass';
import { RenderTargetHandle, RenderPass, RenderPassAttachmentStorageType, RenderPassDestroyAttachmentType, RenderPassPriorityNormal } from './render-pass';
import type { Renderer } from './renderer';
import { BloomThresholdPass, HQGaussianDownSamplePass, HQGaussianUpSamplePass, ToneMappingPass } from './post-process-pass';
import type { GlobalVolume } from './global-volume';
import { defaultGlobalVolume } from './global-volume';

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
   * 纹理对象，用于 FrameBuffer 的颜色 Attachment
   */
  color_a: Texture,
  /**
   * 纹理对象，用于 FrameBuffer 的颜色 Attachment
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
  globalVolume?: Partial<GlobalVolume>,
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
  globalVolume: GlobalVolume;
  renderer: Renderer;
  resource: RenderFrameResource;
  keepColorBuffer?: boolean;
  editorTransform: Vector4;

  /**
   * 名称
   */
  readonly name: string;
  /**
   * 公用 Uniform 变量表
   */
  readonly semantics: SemanticMap;
  readonly globalUniforms: GlobalUniforms;
  /**
   * 空纹理，大小1x1，白色
   */
  readonly emptyTexture: Texture;
  /**
   * 空纹理，大小1x1，透明
   */
  readonly transparentTexture: Texture;

  protected destroyed = false;
  protected renderPassInfoMap: WeakMap<RenderPass, RenderPassInfo> = new WeakMap();

  constructor (options: RenderFrameOptions) {
    const {
      camera, keepColorBuffer, renderer,
      editorTransform = [1, 1, 0, 0],
      globalVolume,
      clearAction = {
        colorAction: TextureLoadAction.whatever,
        stencilAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.whatever,
      },
    } = options;
    const engine = renderer.engine;

    if (globalVolume) {
      this.globalVolume = {
        ...defaultGlobalVolume,
        ...globalVolume,
      };
    }
    this.globalUniforms = new GlobalUniforms();
    let attachments: RenderPassColorAttachmentOptions[] = [];  //渲染场景物体Pass的RT
    let depthStencilAttachment;
    let drawObjectPassClearAction = {};

    this.renderer = renderer;
    if (this.globalVolume) {
      const { useHDR } = this.globalVolume;
      // 使用HDR浮点纹理，FLOAT在IOS上报错，使用HALF_FLOAT
      const textureType = useHDR ? glContext.HALF_FLOAT : glContext.UNSIGNED_BYTE;

      attachments = [{ texture: { format: glContext.RGBA, type: textureType, magFilter: glContext.LINEAR, minFilter: glContext.LINEAR } }];
      depthStencilAttachment = { storageType: RenderPassAttachmentStorageType.depth_stencil_opaque };
      drawObjectPassClearAction = {
        colorAction: TextureLoadAction.clear,
        stencilAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.clear,
      };
    }

    // 创建 drawObjectPass
    const renderPasses = [
      new RenderPass(renderer, {
        name: RENDER_PASS_NAME_PREFIX,
        priority: RenderPassPriorityNormal,
        meshOrder: OrderType.ascending,
        depthStencilAttachment,
        attachments,
        clearAction: drawObjectPassClearAction,
      }),
    ];

    this.setRenderPasses(renderPasses);

    if (this.globalVolume) {
      const useBloom = this.globalVolume.useBloom;
      const sceneTextureHandle = new RenderTargetHandle(engine);  //保存后处理前的屏幕图像

      if (useBloom) {
        const gaussianStep = 7; // 高斯模糊的迭代次数，次数越高模糊范围越大
        const viewport: vec4 = [0, 0, this.renderer.getWidth() / 2, this.renderer.getHeight() / 2];

        const gaussianDownResults = new Array<RenderTargetHandle>(gaussianStep);  //存放多个高斯Pass的模糊结果，用于Bloom
        const textureType = this.globalVolume.useHDR ? glContext.HALF_FLOAT : glContext.UNSIGNED_BYTE;
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
          const gaussianDownHPass = new HQGaussianDownSamplePass(renderer, 'H', {
            name: 'GaussianDownPassH' + i,
            viewport,
            attachments: [{
              texture: {
                format: glContext.RGBA,
                type: textureType,
                minFilter: glContext.LINEAR,
                magFilter: glContext.LINEAR,
              },
            }],
          });
          const gaussianDownVPass = new HQGaussianDownSamplePass(renderer, 'V', {
            name: 'GaussianDownPassV' + i,
            viewport,
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
          const gaussianUpPass = new HQGaussianUpSamplePass(renderer, {
            name: 'GaussianUpPass' + i,
            viewport,
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
      }

      let postProcessPass: ToneMappingPass;

      if (useBloom) {
        postProcessPass = new ToneMappingPass(renderer, sceneTextureHandle);
      } else {
        postProcessPass = new ToneMappingPass(renderer);
      }

      this.addRenderPass(postProcessPass);
    }

    this.semantics = new SemanticMap(options.semantics);
    this.clearAction = clearAction;
    this.name = `RenderFrame${seed++}`;

    const firstRP = renderPasses[0];
    const sourceOpts = {
      type: glContext.UNSIGNED_BYTE,
      format: glContext.RGBA,
      internalFormat: glContext.RGBA,
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
      minFilter: glContext.NEAREST,
      magFilter: glContext.NEAREST,
    };

    this.emptyTexture = Texture.create(
      engine,
      {
        data: {
          width: 1,
          height: 1,
          data: new Uint8Array([255, 255, 255, 255]),
        },
        sourceType: TextureSourceType.data,
        ...sourceOpts,
      },
    );
    this.transparentTexture = Texture.create(
      engine,
      {
        data: {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        },
        sourceType: TextureSourceType.data,
        ...sourceOpts,
      }
    );
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
  addMeshToDefaultRenderPass (mesh: Mesh) {
    const renderPasses = this.renderPasses;
    const infoMap = this.renderPassInfoMap;
    const { priority } = mesh;

    for (let i = 1; i < renderPasses.length; i++) {
      const renderPass = renderPasses[i - 1];
      const info = infoMap.get(renderPasses[i]);
      const infoBefore = infoMap.get(renderPass);

      if (!info || !infoBefore) {
        continue;
      }

      if (info.listStart > priority && (priority > infoBefore.listEnd || i === 1)) {
        return this.addToRenderPass(renderPass, mesh);
      }
    }

    // TODO diff逻辑待优化，有时会添加进找不到的元素
    let lastId = renderPasses.length - 1;
    let lastDefaultPass = renderPasses[lastId];

    // 找到最后一个 DefaultPass, 直接将元素添加进去
    while (lastId >= 0 && !lastDefaultPass.name.includes(RENDER_PASS_NAME_PREFIX)) {
      lastId--;
      lastDefaultPass = renderPasses[lastId];
    }

    return this.addToRenderPass(lastDefaultPass, mesh);
  }

  /**
   * 把 Mesh 从 RenderPass 中移除，
   * 如果 renderPass 中没有 mesh，此 renderPass 会被删除
   * @param mesh - 要删除的 Mesh 对象
   */
  removeMeshFromDefaultRenderPass (mesh: Mesh) {
    const renderPasses = this.renderPasses;
    const infoMap = this.renderPassInfoMap;

    for (let i = renderPasses.length - 1; i >= 0; i--) {
      const renderPass = renderPasses[i];
      const info = infoMap.get(renderPass)!;

      // 只有渲染场景物体的pass才有 info
      if (!info) {
        continue;
      }

      if (info.listStart <= mesh.priority && info.listEnd >= mesh.priority) {
        const idx = renderPass.meshes.indexOf(mesh);

        if (idx === -1) {
          return;
        }

        // TODO hack: 现在的除了rp1和finalcopy pass，所有renderpass的meshes是一个copy加上一个filter mesh，这里的判断当filter mesh被删除后当前pass需不需要删除，
        // 判断需要更鲁棒。
        const shouldRestoreRenderPass = idx === 1 && renderPass.meshes[0].name === EFFECTS_COPY_MESH_NAME;

        renderPass.removeMesh(mesh);
        if (shouldRestoreRenderPass) {
          const nextRenderPass = renderPasses[i + 1];
          const meshes = renderPass.meshes;

          if (!info.intermedia) {
            info.preRenderPass?.resetColorAttachments([]);
            //this.renderer.extension.resetColorAttachments?.(info.preRenderPass, []);
          }
          for (let j = 1; j < meshes.length; j++) {
            info.preRenderPass?.addMesh(meshes[j]);
          }
          const cp = renderPass.attachments[0]?.texture;
          const keepColor = cp === this.resource.color_a || cp === this.resource.color_b;

          renderPass.dispose({
            meshes: DestroyOptions.keep,
            colorAttachment: keepColor ? RenderPassDestroyAttachmentType.keep : RenderPassDestroyAttachmentType.destroy,
            depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
          });
          removeItem(renderPasses, renderPass);
          this.removeRenderPass(renderPass);
          infoMap.delete(renderPass);
          if (nextRenderPass) {
            this.updateRenderInfo(nextRenderPass);
          }
          if (info.preRenderPass) {
            this.updateRenderInfo(info.preRenderPass);
          }
          if (info.prePasses) {
            info.prePasses.forEach(rp => {
              this.removeRenderPass(rp.pass);
              if (rp?.destroyOptions !== false) {
                rp.pass.attachments.forEach(c => {
                  if (c.texture !== this.resource.color_b || c.texture !== this.resource.color_a) {
                    c.texture.dispose();
                  }
                });
                const options: RenderPassDestroyOptions = {
                  ...(rp?.destroyOptions ? rp.destroyOptions as RenderPassDestroyOptions : {}),
                  depthStencilAttachment: RenderPassDestroyAttachmentType.keep,
                };

                rp.pass.dispose(options);
              }
            });
          }
          this.resetRenderPassDefaultAttachment(renderPasses, Math.max(i - 1, 0));
          if (renderPasses.length === 1) {
            renderPasses[0].resetColorAttachments([]);
            //this.renderer.extension.resetColorAttachments?.(renderPasses[0], []);
            this.removeRenderPass(this.resource.finalCopyRP);
          }
        }

        return this.resetClearActions();
      }
    }
  }

  /**
   * 将 Mesh 所有在 RenderPass 进行切分
   * @param mesh - 目标 Mesh 对象
   * @param options - 切分选项，包含 RenderPass 相关的 Attachment 等数据
   */
  splitDefaultRenderPassByMesh (mesh: Mesh, options: RenderPassSplitOptions): RenderPass {
    const index = this.findMeshRenderPassIndex(mesh);
    const renderPass = this.renderPasses[index];

    if (__DEBUG__) {
      if (!renderPass) {
        throw Error('RenderPassNotFound');
      }
    }
    this.createResource();
    const meshIndex = renderPass.meshes.indexOf(mesh);
    const ms0 = renderPass.meshes.slice(0, meshIndex);
    const ms1 = renderPass.meshes.slice(meshIndex);
    const infoMap = this.renderPassInfoMap;

    // TODO 为什么要加这个判断？
    // if (renderPass.attachments[0] && this.renderPasses[index + 1] !== this.resource.finalCopyRP) {
    //   throw Error('not implement');
    // } else {
    if (!options.attachments?.length) {
      throw Error('should include at least one color attachment');
    }
    const defRPS = this.renderPasses;
    const defIndex = defRPS.indexOf(renderPass);
    const lastDefRP = defRPS[defIndex - 1];

    removeItem(defRPS, renderPass);
    const lastInfo = infoMap.get(renderPass);

    infoMap.delete(renderPass);
    const filter = this.renderer.engine.gpuCapability.level === 2 ? glContext.LINEAR : glContext.NEAREST;
    const rp0 = new RenderPass(this.renderer, {
      name: RENDER_PASS_NAME_PREFIX + defIndex,
      priority: renderPass.priority,
      attachments: [{
        texture: {
          sourceType: TextureSourceType.framebuffer,
          format: glContext.RGBA,
          name: 'frame_a',
          minFilter: filter,
          magFilter: filter,
        },
      }],
      clearAction: renderPass.clearAction || { colorAction: TextureLoadAction.clear },
      storeAction: renderPass.storeAction,
      depthStencilAttachment: this.resource.depthStencil,
      meshes: ms0,
      meshOrder: OrderType.ascending,
    });

    ms1.unshift(this.createCopyMesh());

    const renderPasses = this.renderPasses;

    renderPasses[index] = rp0;
    const prePasses: RenderPass[] = [];

    const restMeshes = ms1.slice();

    if (options.prePasses) {
      options.prePasses.forEach((pass, i) => {
        pass.priority = renderPass.priority + 1 + i;
        pass.setMeshes(ms1);
        prePasses.push(pass);
      });
      renderPasses.splice(index + 1, 0, ...prePasses);
      restMeshes.splice(0, 2);
    }
    const copyRP = this.resource.finalCopyRP;

    if (!renderPasses.includes(copyRP)) {
      renderPasses.push(copyRP);
    }
    // let sourcePass = (prePasses.length && !options.useLastDefaultPassColor) ? prePasses[prePasses.length - 1] : rp0;

    const finalFilterPass = prePasses[prePasses.length - 1];

    finalFilterPass.initialize(this.renderer);

    // 不切RT，接着上一个pass的渲染结果渲染
    const rp1 = new RenderPass(this.renderer, {
      name: RENDER_PASS_NAME_PREFIX + (defIndex + 1),
      priority: renderPass.priority + 1 + (options.prePasses?.length || 0),
      meshes: restMeshes,
      meshOrder: OrderType.ascending,
      depthStencilAttachment: this.resource.depthStencil,
      storeAction: options.storeAction,
      clearAction: {
        depthAction: TextureLoadAction.whatever,
        stencilAction: TextureLoadAction.whatever,
        colorAction: TextureLoadAction.whatever,
      },
    });

    renderPasses.splice(index + 1 + (options.prePasses?.length || 0), 0, rp1);
    this.setRenderPasses(renderPasses);
    this.updateRenderInfo(finalFilterPass);
    this.updateRenderInfo(rp0);
    this.updateRenderInfo(rp1);

    // 目的是删除滤镜元素后，把之前滤镜用到的prePass给删除，逻辑有些复杂，考虑优化
    infoMap.get(rp0)!.prePasses = lastInfo!.prePasses;
    prePasses.pop();
    infoMap.get(finalFilterPass)!.prePasses = prePasses.map((pass, i) => {
      return { pass, destroyOptions: false };
    });
    this.resetClearActions();

    return finalFilterPass;
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
    this.emptyTexture.dispose();
    this.transparentTexture.dispose();
    if (this.resource) {
      this.resource.color_a.dispose();
      this.resource.color_b.dispose();
      this.resource.depthStencil?.texture?.dispose();
      this.resource.finalCopyRP.dispose();
      this.resource.resRP.dispose();
      // @ts-expect-error
      this.resource = null;
    }
    this.destroyed = true;
  }

  /**
   * 重置 RenderPass ColorAttachment，解决 FrameBuffer 即读又写的问题
   * @param renderPasses - RenderPass 对象数组
   * @param startIndex - 开始重置的索引
   */
  resetRenderPassDefaultAttachment (renderPasses: RenderPass[], startIndex: number) {
    let pre: Texture;
    const { color_a, color_b } = this.resource;

    for (let i = startIndex; i < renderPasses.length; i++) {
      const rp = renderPasses[i];
      let tex = rp.attachments[0]?.texture;

      // @ts-expect-error
      if (tex && pre === tex) {
        const next = tex === color_a ? color_b : color_a;

        rp.resetColorAttachments([next]);
        //this.renderer.extension.resetColorAttachments?.(rp as GLRenderPass, [next as GLTexture]);
      }
      tex = rp.attachments[0]?.texture;
      if (tex) {
        pre = tex;
      }
    }
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
    const info = this.renderPassInfoMap.get(renderPass)!;
    const { priority } = mesh;

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

  protected getRPAttachments (
    attachments: RenderPassColorAttachmentOptions[],
    preRP?: RenderPass,
  ): RenderPassColorAttachmentOptions[] {
    if (attachments?.length === 1) {
      const { texture, persistent } = attachments[0];
      const { format } = texture as RenderPassColorAttachmentTextureOptions;
      const previousAttachmens = preRP?.getInitAttachments() ?? [];

      if (format === glContext.RGBA && !persistent) {
        const texA = this.resource.color_a;

        if (previousAttachmens.length === 0) {
          return [{ texture: texA }];
        }
        const texture = previousAttachmens[0].texture === texA ? this.resource.color_b : texA;

        return [{ texture }];
      }
    }

    return attachments;
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

  protected updateRenderInfo (renderPass: RenderPass): RenderPassInfo {
    const map = this.renderPassInfoMap;
    const passes = this.renderPasses;
    let info: RenderPassInfo;

    if (!map.has(renderPass)) {
      info = {
        intermedia: false,
        renderPass: renderPass,
        listStart: 0,
        listEnd: 0,
      };
      map.set(renderPass, info);
    } else {
      info = map.get(renderPass)!;
    }
    info.intermedia = renderPass.attachments.length > 0;
    const meshes = renderPass.meshes;

    if (meshes[0]) {
      info.listStart = (meshes[0].name === EFFECTS_COPY_MESH_NAME ? meshes[1] : meshes[0]).priority;
      info.listEnd = meshes[meshes.length - 1].priority;
    } else {
      info.listStart = 0;
      info.listEnd = 0;
    }
    const index = passes.indexOf(renderPass);
    const depthStencilActon = index === 0 ? TextureLoadAction.clear : TextureLoadAction.whatever;

    if (index === 0) {
      renderPass.clearAction.colorAction = TextureLoadAction.clear;
    }
    renderPass.clearAction.depthAction = depthStencilActon;
    renderPass.clearAction.stencilAction = depthStencilActon;
    if (index > -1) {
      renderPass.semantics.setSemantic('EDITOR_TRANSFORM', () => this.editorTransform);
    } else {
      renderPass.semantics.setSemantic('EDITOR_TRANSFORM', undefined);
    }
    info.preRenderPass = passes[index - 1];

    return info;
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
   * 创建 RenderPass 切分时需要的 GPU 资源
   */
  createResource () {
    const engine = this.renderer.engine;

    if (!this.resource) {
      const { detail, level } = engine.gpuCapability;
      const width = this.renderer.getWidth();
      const height = this.renderer.getHeight();
      const filter = level === 2 ? glContext.LINEAR : glContext.NEAREST;
      const texA = Texture.create(
        engine,
        {
          sourceType: TextureSourceType.framebuffer,
          format: glContext.RGBA,
          name: 'frame_a',
          minFilter: filter,
          magFilter: filter,
        }
      );
      const texB = Texture.create(
        engine,
        {
          sourceType: TextureSourceType.framebuffer,
          format: glContext.RGBA,
          data: {
            width,
            height,
          },
          minFilter: filter,
          magFilter: filter,
          name: 'frame_b',
        }
      );

      const depthStencilType = detail.readableDepthStencilTextures && detail.writableFragDepth ?
        RenderPassAttachmentStorageType.depth_24_stencil_8_texture :
        RenderPassAttachmentStorageType.depth_stencil_opaque;
      const resRP = new RenderPass(this.renderer, {
        depthStencilAttachment: { storageType: depthStencilType },
        attachments: [{ texture: texA }],
      }).initialize(this.renderer);
      const finalCopyRP = new FinalCopyRP(this.renderer, {
        name: 'effects-final-copy',
        priority: RenderPassPriorityNormal + 600,
        clearAction: {
          depthAction: TextureLoadAction.clear,
          stencilAction: TextureLoadAction.clear,
          colorAction: TextureLoadAction.clear,
        },
        meshOrder: OrderType.ascending,
        meshes: [this.createCopyMesh({ blend: true, depthTexture: resRP.getDepthAttachment()?.texture })],
      });

      this.resource = {
        color_a: resRP.attachments[0].texture,
        color_b: texB,
        finalCopyRP,
        depthStencil: resRP.depthAttachment,
        resRP,
      };
    }
  }

  // TODO tex和size没有地方用到。
  /**
   * 创建拷贝 RenderPass 用到的 Mesh 对象
   * @param semantics - RenderPass 渲染时 FrameBuffer 的颜色和深度纹理、大小和是否混合
   */
  createCopyMesh (semantics?: { tex?: string, size?: string, blend?: boolean, depthTexture?: Texture }): Mesh {
    const name = EFFECTS_COPY_MESH_NAME;
    const engine = this.renderer.engine;

    const geometry = Geometry.create(
      engine,
      {
        name,
        mode: glContext.TRIANGLE_STRIP,
        attributes: {
          aPos: {
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
          },
        },
        drawCount: 4,
      });
    const shader = createCopyShader(engine.gpuCapability.level, !!semantics?.depthTexture);

    // FIXME: 如果不把shader添加进shaderLibrary，这里可以移到core中，有性能上的考虑
    this.renderer.getShaderLibrary()!.addShader(shader);
    const material = Material.create(
      engine,
      {
        uniformValues: {
          // @ts-expect-error
          uDepth: semantics?.depthTexture,
        },
        name,
        shader,
      });

    material.blending = false;
    material.depthTest = false;
    material.culling = false;

    if (semantics?.blend) {
      material.blending = true;
      material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];
    }

    return Mesh.create(
      engine,
      {
        name, geometry, material,
        priority: 0,
      },
    );
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

class FinalCopyRP extends RenderPass {
  prePassTexture: Texture;
  override configure (renderer: Renderer): void {
    this.prePassTexture = renderer.getFrameBuffer()!.getColorTextures()[0];
    renderer.setFrameBuffer(null);
  }

  override execute (renderer: Renderer): void {
    renderer.clear(this.clearAction);
    this.meshes[0].material.setTexture('uFilterSource', this.prePassTexture);
    this.meshes[0].material.setVector2('uFilterSourceSize', getTextureSize(this.prePassTexture));
    renderer.renderMeshes(this.meshes);
    if (this.storeAction) {
      renderer.clear(this.storeAction);
    }
  }
}

export class GlobalUniforms {
  floats: Record<string, number> = {};
  ints: Record<string, number> = {};
  // vector3s: Record<string, vec3> = {};
  matrices: Record<string, Matrix4> = {};
  //...

  samplers: string[] = [];  // 存放的sampler名称。
  uniforms: string[] = [];  // 存放的uniform名称（不包括sampler）。
}
