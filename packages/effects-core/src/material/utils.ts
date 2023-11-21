import * as spec from '@galacean/effects-specification';
import { glContext } from '../gl';
import type { ShaderMarcos } from '../render';
import type { Material } from './material';
import { ShaderType } from './types';

export function valIfUndefined<T> (val: any, def: T): T {
  if (val === undefined || val === null) {
    return def;
  }

  return val;
}
export function getPreMultiAlpha (blending?: number): number {
  switch (blending) {
    case spec.BlendingMode.ALPHA:
      return 1;
    case spec.BlendingMode.ADD:
      return 1;
    case spec.BlendingMode.SUBTRACTION:
      return 1;
    case spec.BlendingMode.STRONG_LIGHT:
      return 1;
    case spec.BlendingMode.WEAK_LIGHT:
      return 1;
    case spec.BlendingMode.SUPERPOSITION:
      return 2;
    case spec.BlendingMode.BRIGHTNESS:
      return 3;
    case spec.BlendingMode.MULTIPLY:
      return 0;
    default:
      // 处理undefined
      return 1;
  }
}

const downgradeKeywords: Record<string, Record<string, string>> = {
  [ShaderType.vertex]: {
    in: 'attribute',
    out: 'varying',
  },
  [ShaderType.fragment]: {
    in: 'varying',
  },
};

/**
 * 生成 shader，检测到 WebGL1 上下文会降级
 * @param marcos - 宏定义数组
 * @param shader - 原始 shader 文本
 * @param shaderType - shader 类型
 * @return 去除版本号的 shader 文本
 */
export function createShaderWithMarcos (marcos: ShaderMarcos, shader: string, shaderType: ShaderType, level: number): string {
  const ret: string[] = [];
  let header = '';

  // shader 标志宏，没有其他含义，方便不支持完全的自定义 shader 的三方引擎接入使用
  ret.push('#define GE_RUNTIME');
  if (marcos) {
    marcos.forEach(([key, value]) => {
      if (value === true) {
        ret.push(`#define ${key}`);
      } else if (Number.isFinite(value)) {
        ret.push(`#define ${key} ${value}`);
      }
    });

    header = ret.length ? (ret.join('\n') + '\n') : '';
  }

  const versionTag = /#version\s+\b\d{3}\b\s*(es)?/;
  const GL_TYPE = `WEBGL${level}`;

  header = header + `
#ifndef ${GL_TYPE}
#define ${GL_TYPE}
#endif`;
  let fullShader = header + '\n' + shader;
  // 判断shader是否带有版本头
  const match = fullShader.match(versionTag);
  const version = match ? match[0] : '';

  if (version && version.includes('300')) {
    const reg = new RegExp(`${version}`, 'g');

    // 带版本头且level为1，降级
    if (level === 1) {
      fullShader = fullShader.replace(/\b(in|out)\b/g, str => downgradeKeywords[shaderType][str] ?? str);
    }
    fullShader = fullShader.replace(reg, '\n');
  }

  return fullShader;
}

export function setBlendMode (material: Material, blendMode: number | undefined) {
  switch (blendMode) {
    case undefined:
      material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case spec.BlendingMode.ALPHA:
      material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case spec.BlendingMode.ADD:
      material.blendFunction = [glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE];

      break;
    case spec.BlendingMode.SUBTRACTION:
      material.blendFunction = [glContext.ONE, glContext.ONE, glContext.ZERO, glContext.ONE];
      material.blendEquation = [glContext.FUNC_REVERSE_SUBTRACT, glContext.FUNC_REVERSE_SUBTRACT];

      break;
    case spec.BlendingMode.SUPERPOSITION:
      material.blendFunction = [glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE];

      break;
    case spec.BlendingMode.MULTIPLY:
      material.blendFunction = [glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case spec.BlendingMode.BRIGHTNESS:
      material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case spec.BlendingMode.STRONG_LIGHT:
      material.blendFunction = [glContext.DST_COLOR, glContext.DST_ALPHA, glContext.ZERO, glContext.ONE];

      break;
    case spec.BlendingMode.WEAK_LIGHT:
      material.blendFunction = [glContext.DST_COLOR, glContext.ZERO, glContext.ZERO, glContext.ONE];

      break;
    default:
      console.warn(`blendMode ${blendMode} not in specification, please set blend params separately`);
  }
}

export function setSideMode (material: Material, side: spec.SideMode) {
  if (side === spec.SideMode.DOUBLE) {
    material.culling = false;
  } else {
    material.culling = true;
    material.frontFace = glContext.CW;
    material.cullFace = side === spec.SideMode.BACK ? glContext.BACK : glContext.FRONT;
  }
}

export function setMaskMode (material: Material, maskMode: number) {
  switch (maskMode) {
    case undefined:
      material.stencilTest = false;

      break;
    case spec.MaskMode.MASK:
      material.stencilTest = true;
      material.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
      material.stencilOpZPass = [glContext.REPLACE, glContext.REPLACE];

      break;
    case spec.MaskMode.OBSCURED:
      material.stencilTest = true;
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];

      break;
    case spec.MaskMode.REVERSE_OBSCURED:
      material.stencilTest = true;
      material.stencilFunc = [glContext.NOTEQUAL, glContext.NOTEQUAL];

      break;
    case spec.MaskMode.NONE:
      material.stencilTest = false;

      break;
    default:
      console.warn(`maskMode ${maskMode} not in specification, please set stencil params seperately`);
  }
}
