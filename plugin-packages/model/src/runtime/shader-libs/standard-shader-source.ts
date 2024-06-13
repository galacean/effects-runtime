import { default as animationVertGLSL } from './standard/animation.vert.glsl';
import { default as extensionsFragGLSL } from './standard/extensions.frag.glsl';
import { default as tonemappingFragGLSL } from './standard/tonemapping.frag.glsl';
import { default as texturesVertGLSL } from './standard/textures.vert.glsl';
import { default as functionsFragGLSL } from './standard/functions.frag.glsl';
import { default as shadowFragGLSL } from './standard/shadow.frag.glsl';
import { default as webglCompatibilityGLSL } from './standard/webglcompatibility.glsl';
import { default as shadowCommonVert } from './standard/shadowCommon.vert.glsl';

const glsl: Record<string, string> = {
  'animation.vert.glsl': animationVertGLSL,
  'extensions.frag.glsl': extensionsFragGLSL,
  'tonemapping.frag.glsl': tonemappingFragGLSL,
  'textures.vert.glsl': texturesVertGLSL,
  'functions.frag.glsl': functionsFragGLSL,
  'shadow.frag.glsl': shadowFragGLSL,
  'webglCompatibility.glsl': webglCompatibilityGLSL,
  'shadowCommon.vert.glsl': shadowCommonVert,
};

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
  export function build (source: string, features: string[], isWebGL2: boolean): string {
    let match: RegExpExecArray | null;

    while ((match = (/#include <(.+)>/gm).exec(source)) !== null) {
      source = source.replace(match[0], glsl[match[1]]);
    }

    source = source.replace(/#define FEATURES/,
      features.map(value => `#define ${value}`).join('\n'));

    if (isWebGL2) {
      return '#version 300 es\n' + source;
    } else {
      return '#version 100\n' + source;
    }
  }

  export function getSourceCode (source: string, isWebGL2?: boolean): string {
    let match: RegExpExecArray | null;

    while ((match = (/#include <(.+)>/gm).exec(source)) !== null) {
      source = source.replace(match[0], glsl[match[1]]);
    }

    if (isWebGL2) {
      return '#version 300 es\n' + source;
    } else {
      return '#version 100\n' + source;
    }
  }
}
