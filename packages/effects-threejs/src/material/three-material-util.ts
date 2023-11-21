import type { UniformValue } from '@galacean/effects-core';
import { glContext } from '@galacean/effects-core';
import * as THREE from 'three';

/**
 * WebGL 中和 blend 相关参数到 THREE 的常量映射表
 */
export const CONSTANT_MAP_BLEND: Record<string, THREE.BlendingDstFactor> = {
  [glContext.ONE]: THREE.OneFactor,
  [glContext.ZERO]: THREE.ZeroFactor,
  [glContext.SRC_COLOR]: THREE.SrcColorFactor,
  [glContext.SRC_ALPHA]: THREE.SrcAlphaFactor,
  [glContext.ONE_MINUS_SRC_COLOR]: THREE.OneMinusSrcColorFactor,
  [glContext.ONE_MINUS_SRC_ALPHA]: THREE.OneMinusSrcAlphaFactor,
  [glContext.DST_COLOR]: THREE.DstColorFactor,
  [glContext.DST_ALPHA]: THREE.DstAlphaFactor,
  [glContext.ONE_MINUS_DST_COLOR]: THREE.OneMinusDstColorFactor,
  [glContext.ONE_MINUS_DST_ALPHA]: THREE.OneMinusDstAlphaFactor,

};

/**
 * WebGL 中和 stencil 相关参数到 THREE 的常量映射表
 */
export const CONSTANT_MAP_STENCIL_FUNC: Record<string, THREE.StencilFunc> = {
  [glContext.NEVER]: THREE.NeverStencilFunc,
  [glContext.EQUAL]: THREE.EqualStencilFunc,
  [glContext.LESS]: THREE.LessStencilFunc,
  [glContext.LEQUAL]: THREE.LessEqualStencilFunc,
  [glContext.ALWAYS]: THREE.AlwaysStencilFunc,
  [glContext.NOTEQUAL]: THREE.NotEqualStencilFunc,
  [glContext.GREATER]: THREE.GreaterStencilFunc,
  [glContext.GEQUAL]: THREE.GreaterEqualStencilFunc,

};

/**
 * WebGL 中和 stencil 相关测试结果参数到 THREE 的常量映射表
 */
export const CONSTANT_MAP_STENCIL_OP: Record<string, THREE.StencilOp> = {
  [glContext.KEEP]: THREE.KeepStencilOp,
  [glContext.ZERO]: THREE.ZeroStencilOp,
  [glContext.REPLACE]: THREE.ReplaceStencilOp,
  [glContext.INCR]: THREE.IncrementStencilOp,
  [glContext.DECR]: THREE.DecrementStencilOp,
  [glContext.INCR_WRAP]: THREE.IncrementWrapStencilOp,
  [glContext.DECR_WRAP]: THREE.IncrementWrapStencilOp,
  [glContext.INVERT]: THREE.InvertStencilOp,
};

/**
 * WebGL 中和 depth 相关参数到 THREE 的常量映射表
 */
export const CONSTANT_MAP_DEPTH: Record<string, THREE.DepthModes> = {
  [glContext.NEVER]: THREE.NeverDepth,
  [glContext.ALWAYS]: THREE.AlwaysDepth,
  [glContext.EQUAL]: THREE.EqualDepth,
  [glContext.LESS]: THREE.LessDepth,
  [glContext.LEQUAL]: THREE.LessEqualDepth,
  [glContext.GREATER]: THREE.GreaterDepth,
  [glContext.GEQUAL]: THREE.GreaterEqualDepth,
  [glContext.NOTEQUAL]: THREE.NotEqualDepth,
};

/**
 * THREE 中自定义 shader 在 Galacean Effects 中的设置工具类方法
 *
 * @param uniforms - uniform 缓存以及 THREE 的 material 的 uniform 对象
 * @param name - uniform 名称
 * @param value - uniform 值
 */
export function setUniformValue (uniforms: Record<string, any>, name: string, value: UniformValue | THREE.Matrix4) {
  if (uniforms[name]) {
    uniforms[name].value = value;
  } else {
    uniforms[name] = new THREE.Uniform(value);
  }
}

/**
 * 必须初始化的 uniform 的 map 对象（THREE 必须在初始化的时候赋值）
 */
export const TEXTURE_UNIFORM_MAP = [
  'uMaskTex',
  'uSampler0',
  'uSampler1',
  'uSampler2',
  'uSampler3',
  'uSampler4',
  'uSampler5',
  'uSampler6',
  'uSampler7',
  'uSampler8',
  'uSampler9',
  'uSampler10',
  'uSampler11',
  'uSampler12',
  'uSampler13',
  'uSampler14',
  'uSampler15',
  'uColorOverLifetime',
  'uColorOverTrail',
];
