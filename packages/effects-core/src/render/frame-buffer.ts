import type { Texture } from '../texture';
import type { RenderBuffer } from './render-buffer';
import type { RenderPassAttachmentStorageType, RenderPassDepthStencilAttachmentOptions } from './render-pass';
import type { RenderPassDestroyAttachmentType, RenderPassStoreAction } from './render-pass';
import type { Renderer } from './renderer';

export interface FrameBufferProps {
  attachments: Texture[],
  depthStencilAttachment?: RenderPassDepthStencilAttachmentOptions,
  isCustomViewport?: boolean,
  viewport: [x: number, y: number, width: number, height: number],
  viewportScale?: number,
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
export class FrameBuffer {
  depthStencilStorageType: RenderPassAttachmentStorageType;
  name: string;
  viewportScale: number;
  viewport: [x: number, y: number, width: number, height: number];
  ready: boolean;
  externalStorage: boolean;
  storeAction: RenderPassStoreAction;
  isCustomViewport: boolean;

  static create: (props: FrameBufferProps, renderer: Renderer) => FrameBuffer;

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

  get stencilStorage (): RenderBuffer | undefined {
    // OVERRIDE
    return undefined;
  }

  get depthStorage (): RenderBuffer | undefined {
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

  dispose (opt?: { depthStencilAttachment?: RenderPassDestroyAttachmentType }) {
    // OVERRIDE
  }
}
