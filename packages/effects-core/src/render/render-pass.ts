import type * as spec from '@galacean/effects-specification';
import type { vec4 } from '@galacean/effects-specification';
import type { RendererComponent } from '../components';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { Mesh, MeshDestroyOptions, Renderer } from '../render';
import type { Framebuffer } from '../render';
import type { TextureConfigOptions, TextureLoadAction } from '../texture';
import { Texture, TextureSourceType } from '../texture';
import type { Disposable, Sortable } from '../utils';
import { addByOrder, DestroyOptions, removeItem } from '../utils';
import type { Renderbuffer } from './renderbuffer';

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
  //depth 16 render buffer
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
  colorAttachment?: RenderPassDestroyAttachmentType,
  depthStencilAttachment?: RenderPassDestroyAttachmentType,
};

let seed = 1;

/**
 * RenderPass 抽象类
 */
export class RenderPass implements Disposable, Sortable {
  /**
   * 优先级
   */
  priority: number = 0;
  /**
   * 名称
   */
  name: string = 'RenderPass' + seed++;
  /**
   * 包含的 Mesh 列表
   */
  readonly meshes: RendererComponent[] = [];

  protected disposed = false;
  protected framebuffer: Framebuffer | null;
  protected renderer: Renderer;

  constructor (renderer: Renderer) {
    this.renderer = renderer;
  }

  get isDisposed (): boolean {
    return this.disposed;
  }

  get viewport () {
    return this.getViewport();
  }

  addMesh (mesh: RendererComponent): void {
    addByOrder(this.meshes, mesh);
  }

  removeMesh (mesh: RendererComponent): void {
    removeItem(this.meshes, mesh);
  }

  /**
   * 配置当前pass的RT，在每帧渲染前调用
   */
  configure (renderer: Renderer) {
    // OVERRIDE
  }

  /**
   * 执行当前pass，每帧调用一次
   */
  execute (renderer: Renderer) {
    // OVERRIDE
  }

  /**
   * 每帧所有的pass渲染完后调用，用于清空临时的RT资源
   */
  onCameraCleanup (renderer: Renderer) {
    // OVERRIDE
  }

  /**
   * 获取当前视口大小，格式：[x偏移，y偏移，宽度，高度]
   */
  getViewport (): vec4 {
    const ret = this.framebuffer?.viewport;

    if (ret) {
      return ret;
    }
    const renderer = this.renderer;

    return renderer ? [0, 0, renderer.getWidth(), renderer.getHeight()] : [0, 0, 0, 0];
  }

  /**
   * 销毁 RenderPass
   * @param options - 有选择销毁内部对象
   */
  dispose (options?: RenderPassDestroyOptions) {
    if (this.disposed) {
      return;
    }
    const destroyMeshOption = options?.meshes || undefined;

    if (destroyMeshOption !== DestroyOptions.keep) {
      this.meshes.forEach(mesh => {
        (mesh as Mesh).dispose(destroyMeshOption);
      });
    }
    this.meshes.length = 0;

    this.disposed = true;
  }
}
