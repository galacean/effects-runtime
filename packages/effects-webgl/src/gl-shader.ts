import type { ShaderCompileResult, ShaderWithSource, Texture, Engine, math } from '@galacean/effects-core';
import { spec, ShaderVariant } from '@galacean/effects-core';
import type { GLProgram } from './gl-program';
import type { GLEngine } from './gl-engine';

type Color = math.Color;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

export class GLShaderVariant extends ShaderVariant {
  program: GLProgram;
  compileResult: ShaderCompileResult;
  id: string;
  initialized = false;
  uniformLocations: Record<string, WebGLUniformLocation | null> = {};

  private samplerChannels: Record<string, number> = {};

  constructor (engine: Engine, source: ShaderWithSource) {
    super(engine, source);
  }

  // shader 的 GPU 资源初始化方法，在绘制前调用
  initialize () {
    if (this.initialized) {
      return;
    }
    // 核心初始化都在 compileShader
    // 否则会出现编译了却没有初始化的情况
    (this.engine as GLEngine).shaderLibrary.compileShader(this);
  }

  setFloat (name: string, value: number) {
    (this.engine as GLEngine).setFloat(this.uniformLocations[name], value);
  }
  setInt (name: string, value: number) {
    (this.engine as GLEngine).setInt(this.uniformLocations[name], value);
  }
  setFloats (name: string, value: number[]) {
    (this.engine as GLEngine).setFloats(this.uniformLocations[name], value);
  }
  setTexture (name: string, texture: Texture) {
    (this.engine as GLEngine).setTexture(this.uniformLocations[name], this.samplerChannels[name], texture);
  }
  setVector2 (name: string, value: Vector2) {
    (this.engine as GLEngine).setVector2(this.uniformLocations[name], value);
  }
  setVector3 (name: string, value: Vector3) {
    (this.engine as GLEngine).setVector3(this.uniformLocations[name], value);
  }
  setVector4 (name: string, value: Vector4) {
    (this.engine as GLEngine).setVector4(this.uniformLocations[name], value);
  }
  setColor (name: string, value: Color) {
    (this.engine as GLEngine).setColor(this.uniformLocations[name], value);
  }
  setQuaternion (name: string, value: Quaternion) {
    (this.engine as GLEngine).setQuaternion(this.uniformLocations[name], value);
  }
  setMatrix (name: string, value: Matrix4) {
    (this.engine as GLEngine).setMatrix(this.uniformLocations[name], value);
  }
  setMatrix3 (name: string, value: Matrix3) {
    (this.engine as GLEngine).setMatrix3(this.uniformLocations[name], value);
  }
  setVector4Array (name: string, array: number[]) {
    (this.engine as GLEngine).setVector4Array(this.uniformLocations[name], array);
  }
  setMatrixArray (name: string, array: number[]) {
    (this.engine as GLEngine).setMatrixArray(this.uniformLocations[name], array);
  }

  fillShaderInformation (uniformNames: string[], samplers: string[]) {
    // 避免修改原数组。
    const samplerList = samplers.slice();

    uniformNames = uniformNames.concat(samplerList);
    const avaliableUniforms = (this.engine as GLEngine).getUniforms(this.program.program, uniformNames);

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

  override toData (): void {
    const shaderData = this.defination as spec.ShaderData;

    shaderData.dataType = spec.DataType.Shader;
    shaderData.id = this.guid;
    shaderData.vertex = this.source.vertex;
    shaderData.fragment = this.source.fragment;
  }

  override dispose () {
    if (this.compileResult && this.compileResult.shared) {
      return;
    }
    this.program?.dispose();

    super.dispose();
  }
}
