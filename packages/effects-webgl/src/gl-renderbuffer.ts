import type { RenderbufferProps } from '@galacean/effects-core';
import { throwDestroyedError, Renderbuffer, logger } from '@galacean/effects-core';
import type { GLRendererInternal } from './gl-renderer-internal';

export class GLRenderbuffer extends Renderbuffer {
  buffer: WebGLRenderbuffer | null;

  private initialized = false;
  private renderer?: GLRendererInternal | null;

  constructor (
    props: RenderbufferProps,
    renderer?: GLRendererInternal,
  ) {
    super(props);

    if (renderer !== undefined) {
      this.initialize(renderer);
    }
  }

  initialize (renderer: GLRendererInternal) {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.renderer = renderer;
    this.buffer = renderer.createGLRenderbuffer(this) as WebGLRenderbuffer;
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
      const { gl, pipelineContext: state } = this.renderer;

      state.bindRenderbuffer(gl.RENDERBUFFER, this.buffer);
      if (width && height) {
        gl.renderbufferStorage(gl.RENDERBUFFER, this.format, this.size[0] = width, this.size[1] = height);
      } else {
        logger.error(`Invalid render buffer size: ${width}x${height}.`);
      }
    }
  }

  dispose () {
    if (this.renderer) {
      this.renderer.deleteGLRenderbuffer(this);
      this.renderer = null;
      this.buffer = null;
    }
    this.destroyed = true;
    this.initialize = throwDestroyedError;
  }
}
