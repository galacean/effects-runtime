import type * as spec from '@galacean/effects-specification';
import type { vec4 } from '@galacean/effects-specification';
import type { Camera } from '../camera';
import type { RendererComponent } from '../components';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { Mesh, MeshDestroyOptions, Renderer } from '../render';
import { Framebuffer } from '../render';
import type { SemanticGetter } from './semantic-map';
import { SemanticMap } from './semantic-map';
import type { TextureConfigOptions, TextureLoadAction } from '../texture';
import { Texture, TextureSourceType } from '../texture';
import type { Disposable, Sortable } from '../utils';
import { addByOrder, DestroyOptions, OrderType, removeItem, sortByOrder, throwDestroyedError } from '../utils';
import type { Renderbuffer } from './renderbuffer';
import type { RenderingData } from './render-frame';

export const RenderPassPriorityPrepare = 0;
export const RenderPassPriorityNormal = 1000;
export const RenderPassPriorityPostprocess = 3000;

/**
 * RenderPass Attachment 存储类型
 */
export enum RenderPassAttachmentStorageType {
  none = 0,
  color = 1,
  //stencil 8 render buffer
  stencil_8_opaque = 2,
  //stencil 16 render buffer
  depth_16_opaque = 3,
  //depth 16 & stencil 8 render buffer
  depth_stencil_opaque = 4,
  //depth 16 texture, need gpu.capability.readableDepthStencilTextures
  depth_16_texture = 5,
  //depth 24 texture, need gpu.capability.readableDepthStencilTextures
  depth_24_stencil_8_texture = 6,
}

/**
 * Attachment 结束后清除行为
 */
export enum TextureStoreAction {
  /**
   * 不清除 Attachment
   */
  store = 0,
  /**
   * 清除 Attachment
   */
  clear = 2,
}

/**
 * RenderPass 开始前的清除行为
 */
export interface RenderPassClearAction {
  clearColor?: vec4,
  colorAction?: TextureLoadAction,
  clearDepth?: number,
  depthAction?: TextureLoadAction,
  clearStencil?: number,
  stencilAction?: TextureLoadAction,
}

/**
 * RenderPass 结束后的清除行为
 */
export interface RenderPassStoreAction {
  colorAction?: TextureStoreAction,
  depthAction?: TextureStoreAction,
  stencilAction?: TextureStoreAction,
}

export interface RenderPassColorAttachmentTextureOptions extends spec.TextureFormatOptions, TextureConfigOptions {
  size?: [x: number, y: number],
}

/**
 * RenderPass ColorAttachment 选项
 */
export interface RenderPassColorAttachmentOptions {
  size?: [x: number, y: number],
  name?: string,
  /**
   * ColorAttachment 的纹理参数
   */
  texture?: Texture | RenderPassColorAttachmentTextureOptions,
  /**
   * ColorAttachment 的 Buffer 参数
   */
  buffer?: Renderbuffer,
  /**
   * WebGL2 下 Renderbuffer 超采数目。默认是0，即不启用超采。
   * @default 0
   */
  multiSample?: number,
  /**
   * 是否持久的对象
   */
  persistent?: boolean,
}

export class RenderTargetHandle implements Disposable {
  texture: Texture;
  readonly textureOptions?: RenderPassColorAttachmentTextureOptions;
  readonly externalTexture: boolean;
  protected destroyed = false;

  constructor (engine: Engine, options?: RenderPassColorAttachmentOptions) {
    if (!options) {
      return;
    }
    const { texture, size } = options;

    if (texture instanceof Texture) {
      this.texture = texture;
      this.externalTexture = true;
    } else if (texture) {
      const {
        wrapT, wrapS, minFilter, magFilter, internalFormat,
        format = glContext.RGBA,
        type = glContext.UNSIGNED_BYTE,
      } = texture;

      this.externalTexture = false;
      this.textureOptions = {
        size,
        format,
        type,
        internalFormat: internalFormat || format,
        wrapT,
        wrapS,
        minFilter,
        magFilter,
        name: options.name,
      };
      this.texture = Texture.create(
        engine,
        {
          ...this.textureOptions,
          sourceType: TextureSourceType.framebuffer,
          data: { width: size![0], height: size![1] },
        }
      );
    } else {
      //throw new Error('Color attachment must use texture.');
    }
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.texture.dispose();
    this.destroyed = true;
  }

  get isDestroyed () {
    return this.destroyed;
  }

  get storageType () {
    return RenderPassAttachmentStorageType.color;
  }

  get size (): [x: number, y: number] {
    const tex = this.texture;

    return tex ? [tex.getWidth(), tex.getHeight()] : [0, 0];
  }

  get width (): number {
    return this.texture.getWidth() || 0;
  }

  get height (): number {
    return this.texture.getHeight() || 0;
  }
}

export interface RenderPassDepthStencilAttachment {
  readonly storageType: RenderPassAttachmentStorageType,
  readonly storage?: Renderbuffer,
  readonly texture?: Texture,
}

export interface RenderPassDepthStencilAttachmentOptions {
  storageType: RenderPassAttachmentStorageType,
  storage?: Renderbuffer,
  texture?: Texture,
}

/**
 * RenderPass Attachment 销毁类型
 */
export enum RenderPassDestroyAttachmentType {
  /**
   * 强制销毁
   */
  force = 0,
  /**
   * 保留，不销毁
   */
  keep = 1,
  /**
   * 如果是外部传入的 Attachment，就不销毁
   */
  keepExternal = 2,
  /**
   * 强制销毁
   */
  destroy = force
}

export type RenderPassDestroyOptions = {
  meshes?: MeshDestroyOptions | DestroyOptions.keep,
  semantics?: DestroyOptions,
  colorAttachment?: RenderPassDestroyAttachmentType,
  depthStencilAttachment?: RenderPassDestroyAttachmentType,
};

/**
 * RenderPass 渲染过程回调
 */
export interface RenderPassDelegate {
  /**
   * 开始前回调
   * @param renderPass - 当前 RenderPass
   * @param state - 当前渲染状态
   */
  willBeginRenderPass?: (renderPass: RenderPass, state: RenderingData) => void,
  /**
   * 结束后回调
   * @param renderPass - 当前 RenderPass
   * @param state - 当前渲染状态
   */
  didEndRenderPass?: (renderPass: RenderPass, state: RenderingData) => void,
  /**
   * Mesh 渲染前回调
   * @param mesh - 当前 Mesh
   * @param state - 当前渲染状态
   */
  willRenderMesh?: (mesh: RendererComponent, state: RenderingData) => void,
  /**
   * Mesh 渲染后回调
   * @param mesh - 当前 Mesh
   * @param state - 当前渲染状态
   */
  didRenderMesh?: (mesh: RendererComponent, state: RenderingData) => void,
}

/**
 * RenderPass Attachment 选项
 */
export interface RenderPassAttachmentOptions {
  attachments?: RenderPassColorAttachmentOptions[],
  depthStencilAttachment?: RenderPassDepthStencilAttachmentOptions,
  /**
   * RenderPass 视口大小，如果没有指定，会用 viewportScale 计算
   */
  viewport?: [x: number, y: number, width: number, height: number],
  /**
   * 视口缩放系数
   *  1. viewport 提供时，忽略此参数，RenderPass 视口大小由 viewport 决定；
   *  2. 默认为1，RenderPass 视口大小由画布大小* viewportScale 决定，画布尺寸变化时，RenderPass 视口也会变化；
   */
  viewportScale?: number,
}

export interface RenderPassOptions extends RenderPassAttachmentOptions {
  name?: string,
  meshes?: RendererComponent[],
  priority?: number,
  meshOrder?: OrderType,
  clearAction?: RenderPassClearAction,
  storeAction?: RenderPassStoreAction,
  semantics?: Record<string, SemanticGetter>,
  delegate?: RenderPassDelegate,
}

let seed = 1;

/**
 * RenderPass 抽象类
 */
export class RenderPass implements Disposable, Sortable {
  /**
   * 优先级
   */
  priority: number;
  /**
   * 渲染时的回调函数
   */
  delegate: RenderPassDelegate;
  /**
   * ColorAttachment 数组
   */
  attachments: RenderTargetHandle[] = [];
  framebuffer: Framebuffer | null;
  /**
   * 名称
   */
  readonly name: string;
  /**
   * 包含的 Mesh 列表
   */
  readonly meshes: RendererComponent[];
  /**
   * Mesh 渲染顺序，按照优先级升序或降序
   */
  readonly meshOrder: OrderType;
  /**
   * 相机
   */
  readonly camera?: Camera;
  /**
   * 深度和蒙版 Attachment 类型，注意区分纹理和 Renderbuffer
   */
  readonly depthStencilType: RenderPassAttachmentStorageType;
  /**
   * 渲染前清除缓冲区操作
   */
  readonly clearAction: RenderPassClearAction;
  /**
   * 渲染后清除缓冲区操作，iOS 上有性能提升, 默认关闭
   */
  readonly storeAction: RenderPassStoreAction;
  /**
   * RenderPass 公用的 Shader Uniform 变量
   */
  readonly semantics: SemanticMap;

  protected destroyed = false;
  protected options: RenderPassAttachmentOptions;
  protected renderer: Renderer;

  private initialized = false;
  private viewportScale: number;
  private depthTexture?: Texture;
  private stencilTexture?: Texture;
  private isCustomViewport: boolean;
  private customViewport?: [x: number, y: number, width: number, height: number];

  constructor (renderer: Renderer, options: RenderPassOptions) {
    const {
      name = 'RenderPass_' + seed++,
      clearAction, semantics,
      depthStencilAttachment, storeAction,
      priority = 0,
      meshOrder = OrderType.ascending,
      meshes = [],
      delegate = {},
    } = options;

    this.name = name;
    this.renderer = renderer;
    this.priority = priority;
    this.meshOrder = meshOrder;
    this.meshes = sortByOrder(meshes.slice(), this.meshOrder);
    this.depthStencilType = depthStencilAttachment?.storageType || RenderPassAttachmentStorageType.none;

    this.clearAction = {
      ...clearAction,
    };
    this.storeAction = {
      colorAction: TextureStoreAction.store,
      depthAction: TextureStoreAction.store,
      stencilAction: TextureStoreAction.store,
      ...storeAction,
    };
    this.semantics = new SemanticMap(semantics);
    this.options = options;
    this.delegate = delegate;
    this.setViewportOptions(options);
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  get viewport () {
    return this.getViewport();
  }

  get stencilAttachment () {
    return this.getStencilAttachment();
  }

  get depthAttachment () {
    return this.getDepthAttachment();
  }

  addMesh (mesh: RendererComponent): void {
    addByOrder(this.meshes, mesh, this.meshOrder);
  }

  removeMesh (mesh: RendererComponent): void {
    removeItem(this.meshes, mesh);
  }

  setMeshes (meshes: RendererComponent[]): RendererComponent[] {
    this.meshes.length = 0;
    this.meshes.splice(0, 0, ...meshes);
    sortByOrder(this.meshes, this.meshOrder);

    return this.meshes;
  }

  /**
   * 获取当前 Attachment 数组，注意 RenderPass 可能没有创建完成
   */
  getInitAttachments () {
    if (this.attachments.length > 0) {
      return this.attachments;
    } else {
      return this.options.attachments;
    }
  }

  // TODO 所有pass在子类配置
  /**
   * 配置当前pass的RT，在每帧渲染前调用
   */
  configure (renderer: Renderer) {
    if (this.framebuffer) {
      renderer.setFramebuffer(this.framebuffer);
    } else {
      const [x, y, width, height] = this.getViewport();

      renderer.setViewport(x, y, width, height);
    }
  }

  /**
   * 执行当前pass，每帧调用一次
   */
  execute (renderer: Renderer) {
    renderer.clear(this.clearAction);
    renderer.renderMeshes(this.meshes);
    renderer.clear(this.storeAction);
  }

  /**
   * 每帧所有的pass渲染完后调用，通常用于清空临时的RT资源
   */
  frameCleanup (renderer: Renderer) {

  }

  /**
   * 重置 ColorAttachment 数组，会直接替换掉
   * @param colors - 纹理数组，作为新的 ColorAttachment
   */
  resetColorAttachments (colors: Texture[]) {
    if (!colors.length) {
      this.resetAttachments({ attachments: [] });
    }
    if (!this.attachments.length) {
      this.resetAttachments({ attachments: colors.map(t => ({ texture: t })) });
    } else {
      const attachments = colors.map(texture => {
        texture.updateSource({ sourceType: TextureSourceType.framebuffer });

        return new RenderTargetHandle(this.renderer.engine, { texture });
      });

      this.attachments.forEach(att => !att.externalTexture && att.dispose());
      this.attachments = attachments;
      if (this.framebuffer) {
        this.framebuffer.bind();
        this.framebuffer.resetColorTextures(colors.map(color => color));
      }
    }
  }

  /**
   * 重置所有 Attachment，会替换掉所有 Attachment
   * @param options - Attachment 和视口数据
   */
  resetAttachments (options: RenderPassAttachmentOptions) {
    this.options = options;
    this.setViewportOptions(options);
    if (this.renderer) {
      this._resetAttachments();
    }
  }

  private setViewportOptions (options: RenderPassAttachmentOptions) {
    if (options.viewport) {
      this.isCustomViewport = true;
      this.viewportScale = 1;
      this.customViewport = options.viewport.slice(0, 4) as [x: number, y: number, width: number, height: number];
      if (this.framebuffer) {
        const vp = this.customViewport;

        // TODO 为什么framebuffer和renderpass的isCustomViewport不一样？
        this.framebuffer.isCustomViewport = false;
        this.framebuffer.resize(vp[0], vp[1], vp[2], vp[3]);
      }
    } else {
      this.isCustomViewport = false;
      this.viewportScale = options.viewportScale || 1;
      if (this.framebuffer) {
        this.framebuffer.isCustomViewport = true;
        this.framebuffer.viewportScale = this.viewportScale;
      }
    }
  }

  private _resetAttachments () {
    const renderer = this.renderer;
    const options = this.options;

    if (this.attachments.length) {
      this.attachments.forEach(att => !att.externalTexture && att.dispose());
      this.attachments.length = 0;
      this.framebuffer?.dispose({ depthStencilAttachment: RenderPassDestroyAttachmentType.keepExternal });
      this.framebuffer = null;
    }
    const vs = this.viewportScale;
    // renderpass 的 viewport 相关参数都需要动态的修改
    const viewport = (this.isCustomViewport ? this.customViewport : [0, 0, renderer.getWidth() * vs, renderer.getHeight() * vs]) as vec4;

    const size: [x: number, y: number] = [viewport[2], viewport[3]];
    const name = this.name;

    if (options.attachments?.length) {
      const attachments = options.attachments.map((attr, index) => {
        const attachment = new RenderTargetHandle(
          this.renderer.engine,
          {
            size,
            name: attr.texture?.name || `${name}##color_${index}`,
            ...attr,
          });

        return attachment;
      });

      this.attachments = attachments;
      const framebuffer = Framebuffer.create({
        storeAction: this.storeAction,
        name,
        viewport,
        viewportScale: this.viewportScale,
        isCustomViewport: this.isCustomViewport,
        attachments: attachments.map(att => att.texture),
        depthStencilAttachment: options.depthStencilAttachment || { storageType: RenderPassAttachmentStorageType.none },
      }, renderer);

      framebuffer.bind();
      framebuffer.unbind();
      this.framebuffer = framebuffer;
    } else {
      this.attachments.length = 0;
    }
  }

  /**
   * 获取当前视口大小，格式：[x偏移，y偏移，宽度，高度]
   */
  getViewport (): vec4 {
    const ret = this.framebuffer?.viewport || this.customViewport;

    if (ret) {
      return ret;
    }
    const renderer = this.renderer;
    const vs = this.viewportScale;

    return renderer ? [0, 0, renderer.getWidth() * vs, renderer.getHeight() * vs] : [0, 0, 0, 0];
  }

  /**
   * 获取深度 Attachment，可能没有
   */
  getDepthAttachment (): RenderPassDepthStencilAttachment | undefined {
    const framebuffer = this.framebuffer;

    if (framebuffer) {
      const depthTexture = framebuffer.getDepthTexture();
      const texture = depthTexture ? this.getDepthTexture(depthTexture, framebuffer.externalStorage) : undefined;

      return {
        storageType: framebuffer.depthStencilStorageType,
        storage: framebuffer.depthStorage,
        texture,
      };
    }
  }

  /**
   * 获取蒙版 Attachment，可能没有
   */
  getStencilAttachment (): RenderPassDepthStencilAttachment | undefined {
    const framebuffer = this.framebuffer;

    if (framebuffer) {
      const stencilTexture = framebuffer.getStencilTexture();
      const texture = stencilTexture ? this.getDepthTexture(stencilTexture, framebuffer.externalStorage) : undefined;

      return {
        storageType: framebuffer.depthStencilStorageType,
        storage: framebuffer.stencilStorage,
        texture,
      };
    }
  }

  private getDepthTexture (texture: Texture, external: boolean): Texture {
    if (!this.depthTexture) {
      const outTex = this.options.depthStencilAttachment?.texture;
      const tex = texture === outTex ? outTex : texture;

      // TODO 为什么要initialize？
      //tex.initialize(this.renderer.glRenderer.engine);
      if (!external) {
        this.depthTexture = tex;
      }

      return tex;
    }

    return this.depthTexture;
  }

  private getStencilTexture (texture: Texture, external: boolean): Texture {
    if (!this.stencilTexture) {
      const outTex = this.options.depthStencilAttachment?.texture;
      const tex = texture === outTex ? outTex : texture;

      if (!external) {
        this.stencilTexture = tex;
      }

      return tex;
    }

    return this.stencilTexture;
  }

  // 生成并初始化帧缓冲
  initialize (renderer: Renderer): RenderPass {
    if (!this.initialized) {
      this._resetAttachments();
      this.initialized = true;
    }

    return this;
  }

  /**
   * 销毁 RenderPass
   * @param options - 有选择销毁内部对象
   */
  dispose (options?: RenderPassDestroyOptions) {
    if (this.destroyed) {
      return;
    }
    const destroyMeshOption = options?.meshes || undefined;

    if (destroyMeshOption !== DestroyOptions.keep) {
      this.meshes.forEach(mesh => {
        (mesh as Mesh).dispose(destroyMeshOption);
      });
    }
    this.meshes.length = 0;

    const colorOpt = options?.colorAttachment ? options.colorAttachment : RenderPassDestroyAttachmentType.force;

    this.attachments.forEach(att => {
      const keep = (att.externalTexture && colorOpt === RenderPassDestroyAttachmentType.keepExternal) || colorOpt === RenderPassDestroyAttachmentType.keep;

      if (!keep) {
        att.dispose();
      }
    });
    this.attachments.length = 0;
    if (options?.semantics !== DestroyOptions.keep) {
      this.semantics.dispose();
    }

    this.destroyed = true;
    const depthStencilOpt = options?.depthStencilAttachment ? options.depthStencilAttachment : RenderPassDestroyAttachmentType.force;
    const fbo = this.framebuffer;

    if (fbo) {
      fbo.dispose({ depthStencilAttachment: depthStencilOpt });
      const keep = (fbo.externalStorage && depthStencilOpt === RenderPassDestroyAttachmentType.keepExternal) || depthStencilOpt === RenderPassDestroyAttachmentType.keep;

      if (!keep) {
        this.stencilTexture?.dispose();
        this.depthTexture?.dispose();
      }
    }

    // @ts-expect-error safe to assign
    this.options = this.renderer = null;
    this.initialize = throwDestroyedError as unknown as (r: Renderer) => RenderPass;
  }
}
