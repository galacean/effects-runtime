import type { ShaderCompileResult, ShaderWithSource, Texture, Engine } from '@galacean/effects-core';
import { Shader } from '@galacean/effects-core';
import type { GLProgram } from './gl-program';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLEngine } from './gl-engine';

export class GLShader extends Shader {
  pipelineContext: GLPipelineContext;
  program: GLProgram;
  compileResult: ShaderCompileResult;
  id: string;
  initialized = false;
  uniformLocations: Record<string, WebGLUniformLocation | null> = {};

  private samplerChannels: Record<string, number> = {};

  constructor (source: ShaderWithSource) {
    super(source);
  }

  // shader 的 GPU 资源初始化方法，在绘制前调用
  initialize (engine: Engine) {
    if (this.initialized) {
      return;
    }
    // 核心初始化都在 compileShader
    // 否则会出现编译了却没有初始化的情况
    const pipelineContext = (engine as GLEngine).getGLPipelineContext();

    pipelineContext.shaderLibrary.compileShader(this);
  }

  public setFloat (name: string, value: number) {
    this.pipelineContext.setFloat(this.uniformLocations[name], value);
  }
  public setInt (name: string, value: number) {
    this.pipelineContext.setInt(this.uniformLocations[name], value);
  }
  public setFloats (name: string, value: number[]) {
    this.pipelineContext.setFloats(this.uniformLocations[name], value);
  }
  public setTexture (name: string, texture: Texture) {
    this.pipelineContext.setTexture(this.uniformLocations[name], this.samplerChannels[name], texture);
  }
  public setVector2 (name: string, value: number[]) {
    this.pipelineContext.setVector2(this.uniformLocations[name], value);
  }
  public setVector3 (name: string, value: number[]) {
    this.pipelineContext.setVector3(this.uniformLocations[name], value);
  }
  public setVector4 (name: string, value: number[]) {
    this.pipelineContext.setVector4(this.uniformLocations[name], value);
  }
  public setMatrix (name: string, value: number[]) {
    this.pipelineContext.setMatrix(this.uniformLocations[name], value);
  }
  public setMatrix3 (name: string, value: number[]) {
    this.pipelineContext.setMatrix3(this.uniformLocations[name], value);
  }
  public setVector4Array (name: string, array: number[]) {
    this.pipelineContext.setVector4Array(this.uniformLocations[name], array);
  }
  public setMatrixArray (name: string, array: number[]) {
    this.pipelineContext.setMatrixArray(this.uniformLocations[name], array);
  }

  public fillShaderInformation (uniformNames: string[], samplers: string[]) {
    // 避免修改原数组。
    const samplerList = samplers.slice();

    uniformNames = uniformNames.concat(samplerList);
    const avaliableUniforms = this.pipelineContext.getUniforms(this.program.program, uniformNames);

    for (let i = 0; i < uniformNames.length; i++) {
      this.uniformLocations[uniformNames[i]] = avaliableUniforms[i];
    }

    let index: number;

    for (index = 0; index < samplerList.length; index++) {
      const sampler = this.uniformLocations[(samplerList[index])];

      if (sampler == null) {
        samplerList.splice(index, 1);
        index--;
      }
    }

    for (index = 0; index < samplerList.length; index++) {
      const samplerName = samplerList[index];

      this.samplerChannels[samplerName] = index;
    }
  }

  dispose () {
    if (this.compileResult && this.compileResult.shared) {
      return;
    }
    this.program?.dispose();
  }
}
