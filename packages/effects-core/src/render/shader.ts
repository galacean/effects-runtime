export type ShaderMarcos = [key: string, value: string | number | boolean][];

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
export interface InstancedShaderWithSource {
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
  marcos?: ShaderMarcos,
  /**
   * shader是否共享
   */
  shared?: false,
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
  marcos?: ShaderMarcos,
  /**
   * 是否共用GLProgram
   * shared为true时，
   * 如果提供了cacheId，cacheId相同的shader会共用一个GLProgram
   * 如果没有提供cacheId，会根据字符串hash计算出cacheId，字符串相同的shader将会使用同一个GLProgram
   */
  shared?: true,
  /**
   * 相同cacheId的shader会使用同一个GLProgram
   */
  cacheId?: string,
}

export type ShaderWithSource = InstancedShaderWithSource | SharedShaderWithSource;

export abstract class Shader {
  constructor (
    public readonly source: ShaderWithSource,
  ) { }
}

// TODO: 临时用，待移除
export interface ShaderLibrary {
  readonly shaderResults: { [cacheId: string]: ShaderCompileResult },

  addShader(shader: ShaderWithSource): void,

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
