import type { Texture } from '../texture';
import type { Renderbuffer } from './renderbuffer';
import type { RenderPassAttachmentStorageType, RenderPassDepthStencilAttachmentOptions } from './render-pass';
import type { RenderPassDestroyAttachmentType, RenderPassStoreAction } from './render-pass';
import type { Renderer } from './renderer';

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
export class Framebuffer {
  depthStencilStorageType: RenderPassAttachmentStorageType;
  name: string;
  viewport: [x: number, y: number, width: number, height: number];
  ready: boolean;
  externalStorage: boolean;
  storeAction: RenderPassStoreAction;

  static create: (props: FramebufferProps, renderer: Renderer) => Framebuffer;

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

  get stencilStorage (): Renderbuffer | undefined {
    // OVERRIDE
    return undefined;
  }

  get depthStorage (): Renderbuffer | undefined {
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

  dispose (options?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    // OVERRIDE
  }
}
