import { ShaderFactory } from '@galacean/effects';
import { default as animationVertGLSL } from './standard/animation.vert.glsl';
import { default as extensionsFragGLSL } from './standard/extensions.frag.glsl';
import { default as toneMappingFragGLSL } from './standard/tone-mapping.frag.glsl';
import { default as texturesVertGLSL } from './standard/textures.vert.glsl';
import { default as functionsFragGLSL } from './standard/functions.frag.glsl';
import { default as shadowFragGLSL } from './standard/shadow.frag.glsl';
import { default as shadowCommonVert } from './standard/shadow-common.vert.glsl';

/**
 * GLSL 着色器代码编译预处理
 */
export namespace StandardShaderSource {
  /**
   * GLSL 代码预处理和生成最终代码
   * @param source - GLSL 代码
   * @param features - 宏定义
   * @param isWebGL2 - 是否 WebGL2
   * @returns 最终代码
   */
  export function build (source: string, features: string[]): string {

    source = source.replace(/#define FEATURES/,
      features.map(value => `#define ${value}`).join('\n'));

    return source;
  }
}

ShaderFactory.registerInclude('animation.vert.glsl', animationVertGLSL);
ShaderFactory.registerInclude('extensions.frag.glsl', extensionsFragGLSL);
ShaderFactory.registerInclude('tone-mapping.frag.glsl', toneMappingFragGLSL);
ShaderFactory.registerInclude('textures.vert.glsl', texturesVertGLSL);
ShaderFactory.registerInclude('functions.frag.glsl', functionsFragGLSL);
ShaderFactory.registerInclude('shadow.frag.glsl', shadowFragGLSL);
ShaderFactory.registerInclude('shadow-common.vert.glsl', shadowCommonVert);

