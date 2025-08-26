import type { Disposable } from '@galacean/effects-core';
import type { GLGeometry } from './gl-geometry';
import { GLVertexArrayObject } from './gl-vertex-array-object';
import type { GLEngine } from './gl-engine';

export interface ProgramAttributeInfo {
  readonly name: string,
  readonly size: number,
  readonly type: number,
  readonly loc: number,
}

// TODO: 待移除？
export interface ProgramUniformInfo {
  readonly loc: WebGLUniformLocation,
  readonly subInfos: ProgramUniformInfo[],
  readonly name: string,
  readonly size: number,
  readonly type: number,
  readonly textureIndex: number,
  readonly isTexture: boolean,
}
export class GLProgram implements Disposable {
  private attribInfoMap: Record<string, ProgramAttributeInfo>;

  constructor (
    public engine: GLEngine,
    public readonly program: WebGLProgram,
    private readonly id: string,
  ) {
    this.engine.useProgram(program);

    this.attribInfoMap = this.createAttribMap();

    this.engine.useProgram(null);
    //gl.activeTexture(gl.TEXTURE0);
    //this.engine.activeTexture(gl.TEXTURE0);
    //emptyTexture2D.bind();
    //this.uniformInfoMap = uniformMap;
  }

  bind () {
    this.engine.useProgram(this.program);
  }

  /**
   * 绑定 vao 对象并设置顶点属性
   * 如果当前环境不支持 vao，则使用 gl 函数依次设置属性。
   * @param geometry
   * @returns
   */
  setupAttributes (geometry: GLGeometry) {
    const programId = this.id;
    const gl = this.engine.gl;
    let vao: GLVertexArrayObject | undefined;

    if (geometry.vaos[programId]) {
      vao = geometry.vaos[programId];
    } else {
      vao = new GLVertexArrayObject(this.engine, `${geometry.name}-${programId}`);
      if (!vao) {
        console.error('Failed to create VAO object.');
      }
      geometry.vaos[programId] = vao;
    }

    // 兼容小程序下不支持vao
    if (vao && vao.vao) {
      vao.bind();
      if (vao.ready) {
        return vao;
      }
    }
    Object.keys(this.attribInfoMap).forEach(name => {
      const attrInfo = this.attribInfoMap[name];
      const attribute = geometry.attributes[name];

      if (attribute) {
        const buffer = geometry.buffers[attribute.dataSource];

        if (!buffer) {
          throw new Error(`Failed to find a buffer named '${attribute.dataSource || name}'. Please ensure the buffer is correctly initialized and bound.`);
        }
        buffer.bind();
        gl.enableVertexAttribArray(attrInfo.loc);
        gl.vertexAttribPointer(attrInfo.loc, attribute.size, attribute.type, attribute.normalize as boolean, attribute.stride || 0, attribute.offset || 0);
      }
    });
    geometry.indicesBuffer?.bind();
    if (vao) {
      vao.ready = true;
    }

    return vao;
  }

  createAttribMap () {
    const { gl } = this.engine;
    const program = this.program;
    const attribMap: Record<string, ProgramAttributeInfo> = {};
    const num = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < num; i++) {
      const info = gl.getActiveAttrib(program, i);

      if (info) {
        const { name, type, size } = info;
        const loc = gl.getAttribLocation(program, name);

        attribMap[name] = {
          type, name, size, loc,
        };
      }
    }

    return attribMap;
  }

  dispose () {
    if (this.engine) {
      this.engine.gl.deleteProgram(this.program);
    }
  }
}
