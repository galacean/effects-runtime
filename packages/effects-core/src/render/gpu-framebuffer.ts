import type { Texture } from '../texture';
import type { RestoreHandler } from '../utils';
import type { GPURenderbuffer } from './gpu-renderbuffer';
import type { RenderPassAttachmentStorageType, RenderPassDepthStencilAttachmentOptions } from './render-pass';
import type { RenderPassDestroyAttachmentType, RenderPassStoreAction } from './render-pass';
import { GPUResource } from '../gpu-resource';

export interface FramebufferProps {
  attachments: Texture[],
  depthStencilAttachment?: RenderPassDepthStencilAttachmentOptions,
  viewport: [x: number, y: number, width: number, height: number],
  storeAction: RenderPassStoreAction,
  name?: string,
}

export enum FilterMode {
  Nearest,
  Linear,
}

export enum RenderTextureFormat {
  RGBA32,
  RGBAHalf,
}

/**
 *
 */
export abstract class GPUFramebuffer extends GPUResource implements RestoreHandler {
  depthStencilStorageType: RenderPassAttachmentStorageType;
  name: string;
  viewport: [x: number, y: number, width: number, height: number];
  ready: boolean;
  externalStorage: boolean;
  storeAction: RenderPassStoreAction;

  abstract initialize (): void;

  resize (x: number, y: number, width: number, height: number) {
    // OVERRIDE
  }

  resetColorTextures (textures: Texture[]) {
    // OVERRIDE
  }

  unbind () {
    // OVERRIDE
  }

  bind () {
    // OVERRIDE
  }

  get stencilStorage (): GPURenderbuffer | undefined {
    // OVERRIDE
    return undefined;
  }

  get depthStorage (): GPURenderbuffer | undefined {
    // OVERRIDE
    return undefined;
  }

  getDepthTexture (): Texture | undefined {
    // OVERRIDE
    return undefined;
  }

  getStencilTexture (): Texture | undefined {
    // OVERRIDE
    return undefined;
  }

  getColorTextures (): Texture[] {
    // OVERRIDE
    return [];
  }

  restore (): void {
    // OVERRIDE
  }

  override dispose (options?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    super.dispose();
  }
}
