import { DataBuffer } from '@galacean/effects-core';

/**
 * 保存图形上下文中的缓冲区资源。
 */
export class GLDataBuffer extends DataBuffer {
  private readonly buffer: WebGLBuffer;

  constructor (buffer: WebGLBuffer) {
    super();
    this.buffer = buffer;
  }

  override get underlyingResource (): WebGLBuffer {
    return this.buffer;
  }
}
