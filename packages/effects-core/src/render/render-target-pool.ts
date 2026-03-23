import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Texture, TextureSourceType } from '../texture';
import { FilterMode, Framebuffer, RenderTextureFormat } from './framebuffer';
import { RenderPassAttachmentStorageType } from './render-pass';

interface Entry {
  RT: Framebuffer,
  lastFrameReleased: number,
  descriptionHash: string,
  isOccupied: boolean,
}

export class RenderTargetPool {
  private temporaryRTs: Entry[] = [];
  private currentFrame = 0;
  private readonly maxUnusedFrames = 4;

  constructor (
    public engine: Engine,
  ) { }

  /**
   * 清理 RenderTarget 池
   * @param force - 是否强制清理所有未占用的 RT
   * @param framesOffset - 自定义未使用帧数阈值，-1 表示使用默认值
   */
  flush (force = false, framesOffset = -1): void {
    this.currentFrame++;

    const threshold = framesOffset >= 0 ? framesOffset : this.maxUnusedFrames;

    for (let i = 0; i < this.temporaryRTs.length; i++) {
      const entry = this.temporaryRTs[i];

      // 强制清理所有未占用的 RT，或清理超过阈值帧数未使用的 RT
      if (!entry.isOccupied && (force || (this.currentFrame - entry.lastFrameReleased) > threshold)) {
        entry.RT.dispose();
        this.temporaryRTs.splice(i--, 1);
      }
    }
  }

  get (
    name: string,
    width: number,
    height: number,
    depthBuffer = 0,
    filter = FilterMode.Linear,
    format = RenderTextureFormat.RGBA32,
  ): Framebuffer {
    // 使用参数计算 hash 值作为缓存 key
    const hash = `${width}_${height}_${depthBuffer}_${filter}_${format}`;

    for (const entry of this.temporaryRTs) {
      if (!entry.isOccupied && entry.descriptionHash === hash) {
        entry.isOccupied = true;
        entry.RT.name = name;

        return entry.RT;
      }
    }

    let textureFilter;
    let textureType;
    let depthType = RenderPassAttachmentStorageType.none;

    // TODO 建立Map映射
    if (filter === FilterMode.Linear) {
      textureFilter = glContext.LINEAR;
    } else if (filter === FilterMode.Nearest) {
      textureFilter = glContext.NEAREST;
    }
    if (format === RenderTextureFormat.RGBA32) {
      textureType = glContext.UNSIGNED_BYTE;
    } else if (format === RenderTextureFormat.RGBAHalf) {
      textureType = glContext.HALF_FLOAT;
    }
    if (depthBuffer === 0) {
      depthType = RenderPassAttachmentStorageType.none;
    } else if (depthBuffer === 16) {
      depthType = RenderPassAttachmentStorageType.depth_stencil_opaque;
    } else if (depthBuffer === 24) {
      depthType = RenderPassAttachmentStorageType.depth_24_stencil_8_texture;
    }

    const colorAttachment = Texture.create(this.engine, {
      sourceType: TextureSourceType.framebuffer,
      minFilter: textureFilter,
      magFilter: textureFilter,
      internalFormat: glContext.RGBA,
      format: glContext.RGBA,
      type: textureType,
    });

    const newFramebuffer = Framebuffer.create({
      name,
      storeAction: {},
      viewport: [0, 0, width, height],
      attachments: [colorAttachment],
      depthStencilAttachment: { storageType: depthType },
    }, this.engine.renderer);

    const entry: Entry = {
      RT: newFramebuffer,
      lastFrameReleased: 0,
      descriptionHash: hash,
      isOccupied: true,
    };

    this.temporaryRTs.push(entry);

    return entry.RT;
  }

  /**
   * 释放 RenderTarget，使其可以被复用
   * @param rt - 要释放的 Framebuffer
   */
  release (rt: Framebuffer): void {
    for (const entry of this.temporaryRTs) {
      if (entry.RT === rt) {
        entry.isOccupied = false;
        entry.lastFrameReleased = this.currentFrame;

        break;
      }
    }
  }

  dispose (): void {
    for (const entry of this.temporaryRTs) {
      entry.RT.dispose();
    }
  }
}
