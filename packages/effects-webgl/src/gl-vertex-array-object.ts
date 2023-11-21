import type { Disposable } from '@galacean/effects-core';
import { isWebGL2 } from '@galacean/effects-core';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLEngine } from './gl-engine';

export class GLVertexArrayObject implements Disposable {
  ready = false;
  disposed = false;

  readonly vao: WebGLVertexArrayObject | null;

  private vaoExt: OES_vertex_array_object | null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;

  constructor (
    private engine: GLEngine,
    name?: string,
  ) {
    this.gl = engine.getGLPipelineContext().gl;
    this.vaoExt = engine.gpuCapability.vaoExt;
    this.vao = this.createVertexArray(name);
  }

  bind () {
    this.bindVertexArray(this.vao);
  }

  unbind () {
    this.bindVertexArray(null);
  }

  private createVertexArray (name?: string): WebGLVertexArrayObject | null {
    let vao = null;

    if (isWebGL2(this.gl)) {
      vao = this.gl.createVertexArray();
    }
    if (!vao && this.vaoExt) {
      vao = this.vaoExt.createVertexArrayOES();
    }
    if (vao) {
      assignInspectorName(vao, name);
    }

    return vao;
  }

  /**
   * 根据 gpu level 选择对应的绑定函数
   * @param vao
   */
  private bindVertexArray (vao: WebGLVertexArrayObject | null) {
    if (isWebGL2(this.gl)) {
      this.gl.bindVertexArray(vao);
    } else {
      this.vaoExt?.bindVertexArrayOES(vao);
    }
  }

  dispose () {
    if (isWebGL2(this.gl)) {
      this.gl.deleteVertexArray(this.vao);
    } else {
      this.vaoExt?.deleteVertexArrayOES(this.vao as WebGLVertexArrayObjectOES);
    }
  }
}
