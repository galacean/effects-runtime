import type { RenderBufferProps } from '@galacean/effects-core';
import { throwDestroyedError, RenderBuffer, LOG_TYPE } from '@galacean/effects-core';
import type { GLRendererInternal } from './gl-renderer-internal';

export class GLRenderBuffer extends RenderBuffer {
  buffer: WebGLRenderbuffer | null;
  private initialized = false;
  private renderer?: GLRendererInternal | null;

  constructor (
    props: RenderBufferProps,
    renderer?: GLRendererInternal
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
    this.buffer = renderer.createGLRenderBuffer(this) as WebGLRenderbuffer;
  }

  setSize (width: number, height: number) {
    if (!this.initialized) {
      console.error({
        content: 'Can\'t set size for uninitialized render buffer',
        type: LOG_TYPE,
      });

      return;
    }

    if (width !== this.size[0] || height !== this.size[1]) {
      const { gl, pipelineContext: state } = this.renderer!;

      state.bindRenderBuffer(gl.RENDERBUFFER, this.buffer);
      if (width && height) {
        gl.renderbufferStorage(gl.RENDERBUFFER, this.format, this.size[0] = width, this.size[1] = height);
      } else {
        console.error({
          content: `Invalid render buffer size: ${width}x${height}`,
          type: LOG_TYPE,
        });
      }
    }
  }

  dispose () {
    if (this.renderer) {
      this.renderer.deleteGLRenderBuffer(this);
      this.renderer = null;
      this.buffer = null;
    }
    this.destroyed = true;
    this.initialize = throwDestroyedError;
  }
}
