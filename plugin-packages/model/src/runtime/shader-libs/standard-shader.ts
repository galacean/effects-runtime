import { default as primitiveVert } from './standard/primitive.vert.glsl';
import { default as metallicRoughnessFrag } from './standard/metallic-roughness.frag.glsl';
import { default as shadowPassFrag } from './standard/shadowpass.frag.glsl';
import { default as skyboxVert } from './standard/skybox.vert.glsl';
import { default as skyboxFrag } from './standard/skybox.frag.glsl';
import { StandardShaderSource } from './standard-shader-source';
import { PMaterialType } from '../common';
import type { PShaderContext } from '../shader';

/**
 * Shader 代码生成类
 */
export class StandardShader {
  /**
   * WebGL 环境
   */
  static environment = 'webgl1';

  /**
   * 获取 Vertex Shader 代码
   * @param context Shader 环境数据
   * @returns
   */
  static getVertexShaderCode (context: PShaderContext): string {
    const isWebGL2 = context.isWebGL2;
    const features = context.featureList;
    const materialType = context.material.materialType;

    switch (materialType) {
      case PMaterialType.unlit:
      case PMaterialType.pbr:
      case PMaterialType.shadowBase:
        return StandardShaderSource.build(primitiveVert, features, isWebGL2);
      case PMaterialType.skyboxFilter:
        return StandardShaderSource.build(skyboxVert, features, isWebGL2);
      default:
        throw new Error(`Invalid material type ${materialType} for getVertexShaderString!`);
    }
  }

  /**
   * 获取 Fragment Shader 代码
   * @param context Shader 环境数据
   * @returns
   */
  static getFragmentShaderCode (context: PShaderContext): string {
    const isWebGL2 = context.isWebGL2;
    const features = context.featureList;
    const materialType = context.material.materialType;

    switch (materialType) {
      case PMaterialType.unlit:
      case PMaterialType.pbr:
        return StandardShaderSource.build(metallicRoughnessFrag, features, isWebGL2);
      case PMaterialType.shadowBase:
        return StandardShaderSource.build(shadowPassFrag, features, isWebGL2);
      case PMaterialType.skyboxFilter:
        return StandardShaderSource.build(skyboxFrag, features, isWebGL2);
      default:
        throw new Error(`Invalid material type ${materialType} for getFragmentShaderString!`);
    }
  }
}
