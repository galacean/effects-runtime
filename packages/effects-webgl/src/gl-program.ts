import type { Disposable } from '@galacean/effects-core';
import { isWebGL2 } from '@galacean/effects-core';
import type { GLGeometry } from './gl-geometry';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { UniformBlockSpec } from './gl-uniform-utils';
import { createUniformBlockDataFromProgram } from './gl-uniform-utils';
import { GLVertexArrayObject } from './gl-vertex-array-object';
import type { GLEngine } from './gl-engine';

export interface ProgramAttributeInfo {
  readonly name: string,
  readonly size: number,
  readonly type: number,
  readonly loc: number,
}

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
  private readonly uniformBlockMap: Record<string, UniformBlockSpec> = {};
  private attribInfoMap: Record<string, ProgramAttributeInfo>;
  private uniformInfoMap: Record<string, ProgramUniformInfo>;
  private pipelineContext: GLPipelineContext;

  constructor (
    public engine: GLEngine,
    public readonly program: WebGLProgram,
    private readonly shared: boolean,
    private readonly id: string,
  ) {

    let blockUniformNames: string[] = [];

    this.pipelineContext = engine.getGLPipelineContext();
    const gl = this.pipelineContext.gl;

    this.pipelineContext.useProgram(program);

    this.attribInfoMap = this.createAttribMap();
    if (isWebGL2(gl)) {
      const { blockSpecs, blockUniformNames: buns } = createUniformBlockDataFromProgram(gl, program);

      blockUniformNames = buns;
      blockSpecs.forEach(b => this.uniformBlockMap[b.name] = b);
    }

    this.pipelineContext.useProgram(null);
    //gl.activeTexture(gl.TEXTURE0);
    //pipelineContext.activeTexture(gl.TEXTURE0);
    //emptyTexture2D.bind();
    //this.uniformInfoMap = uniformMap;
  }

  bind () {

    this.pipelineContext.useProgram(this.program);
  }

  /**
   * 绑定 vao 对象并设置顶点属性
   * 如果当前环境不支持 vao，则使用 gl 函数依次设置属性。
   * @param geometry
   * @returns
   */
  setupAttributes (geometry: GLGeometry) {
    const programId = this.id;
    const gl = this.pipelineContext.gl;
    let vao: GLVertexArrayObject | undefined;

    if (geometry.vaos[programId]) {
      vao = geometry.vaos[programId]!;
    } else {
      vao = new GLVertexArrayObject(this.engine, `${geometry.name}-${programId}`);
      if (!vao) {
        console.error('创建vao对象失败');
      }
      geometry.vaos[programId] = vao;
    }

    if (vao) {
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
          throw Error(`no buffer named ${attribute.dataSource || name}`);
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
    const { gl } = this.pipelineContext;
    const program = this.program;
    const attribMap: Record<string, ProgramAttributeInfo> = {};
    const num = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < num; i++) {
      const { name, type, size } = gl.getActiveAttrib(program, i)!;
      const loc = gl.getAttribLocation(program, name);

      attribMap[name] = {
        type, name, size, loc,
      };
    }

    return attribMap;
  }

  dispose () {
    if (this.pipelineContext) {
      this.pipelineContext.gl.deleteProgram(this.program);
      // @ts-expect-error safe to assign
      this.pipelineContext = null;
    }
  }
}
