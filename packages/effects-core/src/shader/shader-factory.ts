import { logger } from '../utils';
import type { ShaderMacros } from '../render';
import { ShaderType } from '../material';

export interface ShaderCodeOptions {
  level: number,
  shaderType: ShaderType,
  shader: string,
  macros?: ShaderMacros,
  removeVersion?: boolean,
}

const shaderLib: Record<string, string> = {};

export class ShaderFactory {
  static registerInclude (includeName: string, includeSource: string) {
    if (shaderLib[includeName]) {
      logger.warn(`The "${includeName}" shader include already exist.`);
    }
    shaderLib[includeName] = includeSource;
  }

  static unRegisterInclude (includeName: string) {
    delete shaderLib[includeName];
  }

  static unRegisterAllIncludes () {
    Object.keys(shaderLib).forEach(key => {
      ShaderFactory.unRegisterInclude(key);
    });
  }

  /**
   * 生成 shader，检测到 WebGL1 上下文会降级
   * @param macros - 宏定义数组
   * @param shader - 原始 shader 文本
   * @param shaderType - shader 类型
   * @return 去除版本号的 shader 文本
   */
  static genFinalShaderCode (options: ShaderCodeOptions): string {
    const { level, shaderType, shader, macros, removeVersion } = options;
    const macroString = ShaderFactory.genMacroString(level, macros);
    const versionString = ShaderFactory.genShaderVersion(level);
    let source = ShaderFactory.parseIncludes(shader);
    const isVersion300 = ShaderFactory.isVersion300(source);

    source = ShaderFactory.removeWebGLVersion(source);

    if (level === 2 && !isVersion300) {
      source = ShaderFactory.convertTo300(source, shaderType === ShaderType.fragment);
    }

    if (removeVersion) {
      return macroString + source;
    }

    return versionString + macroString + source;
  }

  /**
   * Convert lower GLSL version to GLSL 300 es.
   * @param source - code
   * @param isFragment - Whether it is a fragment shader.
   * */
  private static convertTo300 (source: string, isFragment?: boolean) {
    source = source.replace(/\bvarying\b/g, isFragment ? 'in' : 'out');
    source = source.replace(/\btexture(2D|Cube)\b/g, 'texture');
    // Remove extensions
    const regex = /#extension.+(GL_OES_standard_derivatives|GL_EXT_shader_texture_lod|GL_EXT_frag_depth|GL_EXT_draw_buffers).+(enable|require)/g;

    source = source.replace(regex, '');

    if (isFragment) {
      source = source.replace(/\btexture(2D|Cube)LodEXT\b/g, 'textureLod');
      source = source.replace(/\btexture(2D|Cube)GradEXT\b/g, 'textureGrad');
      source = source.replace(/\bgl_FragDepthEXT\b/g, 'gl_FragDepth');

      if (!ShaderFactory.has300Output(source)) {
        const isMRT = /\bgl_FragData\[.+?\]/g.test(source);

        if (isMRT) {
          source = source.replace(/\bgl_FragColor\b/g, 'gl_FragData[0]');
          const result = source.match(/\bgl_FragData\[.+?\]/g);

          if (result) {
            source = ShaderFactory.replaceMRTShader(source, result);
          }
        } else {
          source = source.replace(/void\s+?main\s*\(/g, 'out vec4 glFragColor;\nvoid main(');
          source = source.replace(/\bgl_FragColor\b/g, 'glFragColor');
        }
      }
    } else {
      source = source.replace(/\battribute\b/g, 'in');
    }

    return source;
  }

  private static parseIncludes (source: string, regex = /#include <(.+)>/gm) {
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
      const shaderName = match[1];
      const replace = shaderLib[shaderName];

      if (replace === undefined) {
        throw new Error(`Can't find include shader name ${shaderName}`);
      }

      source = source.replace(match[0], replace);
    }

    return source;
  }

  private static genMacroString (
    level: number,
    macros?: ShaderMacros,
    addRuntimeMacro = true,
  ) {
    const macroList: string[] = [];
    const webGLVersion = `WEBGL${level}`;

    macroList.push(`#ifndef ${webGLVersion}`);
    macroList.push(`#define ${webGLVersion}`);
    macroList.push('#endif');

    if (addRuntimeMacro) {
      macroList.push('#define GE_RUNTIME');
    }

    if (macros && macros.length) {
      macros.forEach(([key, value]) => {
        if (value === true) {
          macroList.push(`#define ${key}`);
        } else if (Number.isFinite(value)) {
          macroList.push(`#define ${key} ${value}`);
        }
      });
    }

    if (macroList.length) {
      return macroList.join('\n') + '\n';
    }

    return '';
  }

  private static genShaderVersion (level: number) {
    if (level === 1) {
      return '#version 100\n';
    }

    return '#version 300 es\n';
  }

  private static isVersion300 (source: string) {
    const versionTag = /#version\s+\b\d{3}\b\s*(es)?/;
    const match = source.match(versionTag);
    const version = match ? match[0] : '';

    return version.includes('300');
  }

  private static removeWebGLVersion (source: string) {
    const versionTag = /#version\s+\b\d{3}\b\s*(es)?/;
    const match = source.match(versionTag);

    if (match) {
      return source.replace(match[0], '');
    }

    return source;
  }

  private static has300Output (fragmentShader: string): boolean {
    // [layout(location = 0)] out [highp] vec4 [color];
    const fragReg = /\bout\s+(?:\w+\s+)?(?:vec4)\s+(?:\w+)\s*;/;

    return fragReg.test(fragmentShader);
  }

  private static replaceMRTShader (source: string, result: string[]): string {
    const mrtIndexSet = new Set<string>();
    let declaration = '';

    for (let i = 0; i < result.length; i++) {
      const res = result[i].match(/\bgl_FragData\[(.+?)\]/);

      if (res) {
        mrtIndexSet.add(res[1]);
      }
    }

    mrtIndexSet.forEach(index => {
      declaration += `layout(location=${index}) out vec4 fragOutColor${index};\n`;
    });
    declaration += 'void main(';

    source = source.replace(/\bgl_FragData\[(.+?)\]/g, 'fragOutColor$1');
    source = source.replace(/void\s+?main\s*\(/g, declaration);

    return source;
  }
}

