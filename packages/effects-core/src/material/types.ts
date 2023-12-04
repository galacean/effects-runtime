import type * as spec from '@galacean/effects-specification';
import type { Matrix3, Matrix4, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { Texture } from '../texture';
import type { DestroyOptions } from '../utils';

export type UniformSemantic =
  | 'VIEW'
  | 'MODEL'
  | 'MODELVIEW'
  | 'PROJECTION'
  | 'VIEWPROJECTION'
  | 'VIEWINVERSE'
  | 'EDITOR_TRANSFORM'
  | 'MODELVIEWPROJECTION';

export interface MaterialBlendingStates {
  blending?: boolean,
  blendFunction?: [blendSrc: GLenum, blendDst: GLenum, blendSrcAlpha: GLenum, blendDstAlpha: GLenum],
  blendEquation?: [blendEquationRGB: GLenum, blendEquationAlpha: GLenum],
  blendColor?: [r: number, g: number, b: number, a: number],
}

export interface MaterialStencilStates {
  stencilTest?: boolean,
  stencilMask?: [front: GLenum, back: GLenum],
  stencilRef?: [front: GLenum, back: GLenum],
  stencilFunc?: [front: GLenum, back: GLenum],
  stencilOpFail?: [front: GLenum, back: GLenum],
  stencilOpZFail?: [front: GLenum, back: GLenum],
  stencilOZPass?: [front: GLenum, back: GLenum],
}

export interface MaterialSideStates {
  culling?: boolean,
  cullFace?: GLenum,
  frontFace?: GLenum,
}

export interface MaterialStates extends MaterialBlendingStates, MaterialStencilStates, MaterialSideStates {
  sampleAlphaToCoverage?: boolean,
  colorMask?: [r: boolean, g: boolean, b: boolean, a: boolean],
  depthTest?: boolean,
  depthMask?: boolean,
  depthFunc?: number,
  depthRange?: [zNear: number, zFar: number],
  polygonOffset?: [factor: number, units: number],
  polygonOffsetFill?: boolean,
}

export interface FilterMaterialStates extends MaterialStates {
  blendMode?: spec.BlendingMode,
  side?: spec.SideMode,
  maskMode?: spec.MaskMode,
}

export interface MaterialDataBlockDestroyOptions {
  textures?: DestroyOptions,
}

//使用提前编译的shader进行绘制，传递提前编译的shaderCacheId
/**
 * @example
 * const mtl0 = new Material({
 *  shader:{
 *   fragment:'...',
 *   vertex:'...',
 *   cacheId:'mtl_01'
 * }});
 *
 * const mtl2 = new Material({
 *   shader:{
 *     cacheId:'mtl_01'
 *   }
 * });
 * mtl2 use the same program with mtl0
 */
export type UniformValueDataType = spec.TypedArray | number | number[] | Texture | Texture[] | number[][] | Vector2 | Vector3 | Vector4 | Matrix3 | Matrix4;
export type UniformStruct = Record<string, UniformValueDataType>;

// 支持结构体Uniform数据
export type UniformValue =
  | UniformValueDataType
  | UniformStruct
  | UniformStruct[];

export enum ShaderType {
  vertex = 0,
  fragment = 1
}
