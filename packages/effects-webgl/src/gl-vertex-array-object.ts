import type { Disposable } from '@galacean/effects-core';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLEngine } from './gl-engine';

export class GLVertexArrayObject implements Disposable {
  ready = false;
  disposed = false;

  readonly vao: WebGLVertexArrayObject | null;

  private gl: WebGL2RenderingContext;

  constructor (
    engine: GLEngine,
    name?: string,
  ) {
    this.gl = engine.gl;
    this.vao = this.createVertexArray(name);
  }

  bind () {
    this.gl.bindVertexArray(this.vao);
  }

  unbind () {
    this.gl.bindVertexArray(null);
  }

  private createVertexArray (name?: string): WebGLVertexArrayObject | null {
    const vao = this.gl.createVertexArray();

    assignInspectorName(vao, name);

    return vao;
  }

  dispose () {
    this.gl.deleteVertexArray(this.vao);
  }
}
