import { throwDestroyedError, GPURenderbuffer, logger } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';

export class GPURenderbufferWebGL extends GPURenderbuffer {
  buffer: WebGLRenderbuffer | null = null;

  override initialize (): void {
    if (this.destroyed) {
      throwDestroyedError();
    }
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.size[0] = this.size[1] = 0;
    const device = this.device as RenderingDeviceWebGL;

    this.buffer = device.gl.createRenderbuffer() as WebGLRenderbuffer;
    device.addRenderbuffer(this);
  }

  /**
   * 上下文恢复后重建 renderbuffer 句柄并重新分配存储。
   */
  override restore (): void {
    if (!this.device) {
      return;
    }
    const targetWidth = this.size[0];
    const targetHeight = this.size[1];

    this.releaseGPU();
    this.initialize();
    // Force allocation even when restoring the same dimensions.
    this.size[0] = -1;
    this.size[1] = -1;
    this.setSize(targetWidth, targetHeight);
  }

  override setSize (width: number, height: number) {
    if (!this.initialized) {
      logger.error('Can\'t set size for uninitialized render buffer.');

      return;
    }

    if (!this.device) {
      return;
    }

    if (width !== this.size[0] || height !== this.size[1]) {
      const device = this.device as RenderingDeviceWebGL;
      const gl = device.gl;

      device.bindRenderbuffer(gl.RENDERBUFFER, this.buffer);
      if (width && height) {
        gl.renderbufferStorage(gl.RENDERBUFFER, this.format, this.size[0] = width, this.size[1] = height);
      } else {
        logger.error(`Invalid render buffer size: ${width}x${height}.`);
      }
    }
  }

  protected override onReleaseGPU (): void {
    const device = this.device as RenderingDeviceWebGL;

    device.invalidateRenderbuffer(this.buffer!);
    if (!device.gl.isContextLost()) {
      device.gl.deleteRenderbuffer(this.buffer);
    }
    this.buffer = null;
  }
}
