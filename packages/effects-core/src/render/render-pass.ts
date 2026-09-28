import type { vec4 } from '@galacean/effects-specification';
import type { Renderer } from '../render';
import type { Texture, TextureLoadAction } from '../texture';
import type { Disposable } from '../utils';
import type { GPUResource } from '../gpu-resource';
import type { RenderingData } from './rendering-data';

/** Pass execution stages. Passes at the same event retain enqueue order. */
export enum RenderPassEvent {
  BeforeRendering = 0,
  BeforeRenderingObjects = 100,
  AfterRenderingObjects = 200,
  BeforeRenderingPostProcessing = 300,
  AfterRenderingPostProcessing = 400,
  AfterRendering = 500,
}

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

export interface RenderPassDepthStencilAttachmentOptions {
  storageType: RenderPassAttachmentStorageType,
  /** Backend-owned attachment storage to share between framebuffers. */
  storage?: GPUResource,
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
  colorAttachment?: RenderPassDestroyAttachmentType,
  depthStencilAttachment?: RenderPassDestroyAttachmentType,
};

let seed = 1;

/**
 * RenderPass 抽象类
 */
export class RenderPass implements Disposable {
  /**
   * 执行阶段，同阶段按入队顺序执行。
   */
  renderPassEvent: RenderPassEvent = RenderPassEvent.BeforeRendering;
  /**
   * 名称
   */
  name: string = 'RenderPass' + seed++;
  protected disposed = false;
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

  /**
   * 准备当前阶段的目标和参数并绘制，每次场景渲染调用一次
   */
  execute (renderer: Renderer, data: RenderingData) {
    // OVERRIDE
  }

  /**
   * 本次场景的所有阶段结束后调用，用于清理借用的资源引用。
   */
  onCameraCleanup (renderer: Renderer, data: RenderingData) {
    // OVERRIDE
  }

  /**
   * 获取当前视口大小，格式：[x偏移，y偏移，宽度，高度]
   */
  getViewport (): vec4 {
    return this.renderer.getViewport();
  }

  /**
   * 销毁 RenderPass
   * @param options - 有选择销毁内部对象
   */
  dispose (options?: RenderPassDestroyOptions) {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }
}
