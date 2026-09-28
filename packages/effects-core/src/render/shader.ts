import * as spec from '@galacean/effects-specification';
import type { Color, Matrix3, Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import { Asset } from '../asset';
import type { GPUProgram } from './gpu-program';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import type { Texture } from '../texture';

export type ShaderMacros = [key: string, value: string | number | boolean][];

export enum ShaderCompileResultStatus {
  noShader = 0,
  success = 1,
  fail = 2,
  compiling = 3,
}

export interface ShaderCompileResult {
  status: ShaderCompileResultStatus,
  cacheId?: string,
  error?: string | null,
  shared?: boolean,
  compileTime?: number,
}

export enum GLSLVersion {
  'GLSL1' = '100',
  'GLSL3' = '300 es',
}

export interface SharedShaderWithSource {
  /**
   * fragment shader字符串
   */
  fragment: string,
  /**
   * vertex shader字符串
   */
  vertex: string,
  /**
   * shader 字符串的版本，用于添加版本头
   */
  glslVersion?: GLSLVersion,
  /**
   * shader的name
   */
  name?: string,
  /**
   * shader的宏定义
   */
  macros?: ShaderMacros,
  /**
   * 是否共用GLProgram
   * shared为true时，
   * 如果提供了cacheId，cacheId相同的shader会共用一个GLProgram
   * 如果没有提供cacheId，会根据字符串hash计算出cacheId，字符串相同的shader将会使用同一个GLProgram
   */
  shared?: boolean,
  /**
   * 相同cacheId的shader会使用同一个GLProgram
   */
  cacheId?: string,
}

export type ShaderWithSource = SharedShaderWithSource;

export class ShaderVariant extends Asset {
  shader: Shader;
  program: GPUProgram;
  compileResult: ShaderCompileResult;
  initialized = false;

  private uniformsNames: string[] = [];
  private samplerList: string[] = [];

  constructor (
    engine: Engine,
    public readonly source: ShaderWithSource,
    public readonly key: string,
  ) {
    super(engine);
  }

  initialize (): void {
    if (this.initialized) {
      return;
    }
    this.engine.displayServer.renderingDevice.getShaderLibrary()!.compileShader(this);
  }

  setFloat (name: string, value: number) {
    this.program.setFloat(name, value);
  }
  setInt (name: string, value: number) {
    this.program.setInt(name, value);
  }
  setFloats (name: string, value: number[]) {
    this.program.setFloats(name, value);
  }
  setTexture (name: string, texture: Texture) {
    this.program.setTexture(name, texture);
  }
  setVector2 (name: string, value: Vector2) {
    this.program.setVector2(name, value);
  }
  setVector3 (name: string, value: Vector3) {
    this.program.setVector3(name, value);
  }
  setVector4 (name: string, value: Vector4) {
    this.program.setVector4(name, value);
  }
  setColor (name: string, value: Color) {
    this.program.setColor(name, value);
  }
  setQuaternion (name: string, value: Quaternion) {
    this.program.setQuaternion(name, value);
  }
  setMatrix (name: string, value: Matrix4) {
    this.program.setMatrix(name, value);
  }
  setMatrix3 (name: string, value: Matrix3) {
    this.program.setMatrix3(name, value);
  }
  setVector4Array (name: string, array: number[]) {
    this.program.setVector4Array(name, array);
  }
  setMatrixArray (name: string, array: number[]) {
    this.program.setMatrixArray(name, array);
  }

  fillShaderInformation (uniformNames: string[], samplers: string[]): void {
    // Keep the original names so locations can be queried again after restoration.
    this.uniformsNames = uniformNames.slice();
    this.samplerList = samplers.slice();
    this.program.fillShaderInformation(uniformNames, samplers);
  }

  /** @hide */
  resetForContextRestore (): void {
    this.initialized = false;
  }

  /** @hide Refill locations using the cached names after compilation. */
  refillUniforms () {
    if (!this.initialized || !this.program) {
      return;
    }
    if (this.uniformsNames.length > 0 || this.samplerList.length > 0) {
      this.fillShaderInformation(this.uniformsNames, this.samplerList);
    }
  }

  override toData (): void {
    const shaderData = this.definition as spec.ShaderData;

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

  bind () {
    this.program.bind();
  }

  isReady () {
    return !!this.program;
  }
}

@effectsClass(spec.DataType.Shader)
export class Shader extends Asset {
  shaderData: spec.ShaderData;

  createVariant (macros?: Record<string, number | boolean>) {
    const shaderMacros: ShaderMacros = [];

    if (macros) {
      for (const key of Object.keys(macros)) {
        shaderMacros.push([key, macros[key]]);
      }
    }
    const shaderVariant = this.engine.displayServer.renderingDevice.getShaderLibrary()!.createShader(this.shaderData, shaderMacros);

    shaderVariant.shader = this;

    return shaderVariant;
  }

  override fromData (data: spec.ShaderData): void {
    super.fromData(data);
    this.shaderData = data;
  }
}

// TODO: 临时用，待移除
export interface ShaderLibrary {
  readonly shaderResults: { [cacheId: string]: ShaderCompileResult },

  addShader (shader: ShaderWithSource): void,

  compileShader (shader: ShaderVariant, asyncCallback?: (result: ShaderCompileResult) => void): void,

  createShader (shaderSource: ShaderWithSource, macros?: ShaderMacros): ShaderVariant,

  /**
   * @param cacheId
   */
  deleteShader (cacheId: string): void,

  /***
   * 编译现有的所有shader
   * @param asyncCallback 如果传入，则会启用异步编译，当所有编译完成后被回调
   */
  compileAllShaders (asyncCallback?: (results: ShaderCompileResult[]) => void): void,
}
