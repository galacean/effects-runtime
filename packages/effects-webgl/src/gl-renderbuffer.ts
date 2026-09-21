import type { RenderbufferProps, Renderer } from '@galacean/effects-core';
import { throwDestroyedError, Renderbuffer, logger } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';

export class GLRenderbuffer extends Renderbuffer {
  buffer: WebGLRenderbuffer | null;

  private initialized = false;
  private renderer?: Renderer | null;

  constructor (
    props: RenderbufferProps,
    renderer?: Renderer,
  ) {
    super(props);

    if (renderer !== undefined) {
      this.initialize(renderer);
    }
  }

  initialize (renderer: Renderer) {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.renderer = renderer;
    const device = renderer.engine.graphicsServer.renderingDevice as RenderingDeviceWebGL;

    this.buffer = device.gl.createRenderbuffer() as WebGLRenderbuffer;
    device.addRenderbuffer(this);
  }

  /**
   * 上下文恢复后重建 renderbuffer 句柄并重新分配存储。
   */
  override restore (): void {
    if (!this.renderer) {
      return;
    }
    const gl = (this.renderer.engine.graphicsServer.renderingDevice as RenderingDeviceWebGL).gl;

    // 旧句柄已失效，直接重建。
    this.buffer = gl.createRenderbuffer() as WebGLRenderbuffer;
    // 强制 setSize 重新执行 renderbufferStorage（setSize 在尺寸相同时会跳过）。
    const targetWidth = this.size[0];
    const targetHeight = this.size[1];

    this.size[0] = -1;
    this.size[1] = -1;
    this.setSize(targetWidth, targetHeight);
  }

  setSize (width: number, height: number) {
    if (!this.initialized) {
      logger.error('Can\'t set size for uninitialized render buffer.');

      return;
    }

    if (!this.renderer) {
      return;
    }

    if (width !== this.size[0] || height !== this.size[1]) {
      const device = this.renderer.engine.graphicsServer.renderingDevice as RenderingDeviceWebGL;
      const gl = device.gl;

      device.bindRenderbuffer(gl.RENDERBUFFER, this.buffer);
      if (width && height) {
        gl.renderbufferStorage(gl.RENDERBUFFER, this.format, this.size[0] = width, this.size[1] = height);
      } else {
        logger.error(`Invalid render buffer size: ${width}x${height}.`);
      }
    }
  }

  dispose () {
    if (this.renderer) {
      const device = this.renderer.engine.graphicsServer.renderingDevice as RenderingDeviceWebGL;

      device.deleteGLRenderbuffer(this);
      device.removeRenderbuffer(this);
      this.renderer = null;
      this.buffer = null;
    }
    this.destroyed = true;
    this.initialize = throwDestroyedError;
  }
}
