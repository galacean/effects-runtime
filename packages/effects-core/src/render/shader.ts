import * as spec from '@galacean/effects-specification';
import type { Color, Matrix3, Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import { effectsClass } from '../decorators';
import { EffectsObject } from '../effects-object';
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

export abstract class ShaderVariant extends EffectsObject {
  shader: Shader;

  constructor (
    engine: Engine,
    public readonly source: ShaderWithSource,
  ) {
    super(engine);
  }

  initialize (): void {
    // OVERRIDE
  }

  // uniform 设置接口
  abstract setFloat (name: string, value: number): void;
  abstract setInt (name: string, value: number): void;
  abstract setFloats (name: string, value: number[]): void;
  abstract setTexture (name: string, texture: Texture): void;
  abstract setVector2 (name: string, value: Vector2): void;
  abstract setVector3 (name: string, value: Vector3): void;
  abstract setVector4 (name: string, value: Vector4): void;
  abstract setColor (name: string, value: Color): void;
  abstract setQuaternion (name: string, value: Quaternion): void;
  abstract setMatrix (name: string, value: Matrix4): void;
  abstract setMatrix3 (name: string, value: Matrix3): void;
  abstract setVector4Array (name: string, array: number[]): void;
  abstract setMatrixArray (name: string, array: number[]): void;

  // shader 信息填充（uniform location 查找）
  abstract fillShaderInformation (uniformNames: string[], samplers: string[]): void;

  // program 绑定与就绪检查
  abstract bind (): void;
  abstract isReady (): boolean;
}

@effectsClass(spec.DataType.Shader)
export class Shader extends EffectsObject {
  shaderData: spec.ShaderData;

  createVariant (macros?: Record<string, number | boolean>) {
    const shaderMacros: ShaderMacros = [];

    if (macros) {
      for (const key of Object.keys(macros)) {
        shaderMacros.push([key, macros[key]]);
      }
    }
    const shaderVariant = this.engine.getShaderLibrary()!.createShader(this.shaderData, shaderMacros);

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
