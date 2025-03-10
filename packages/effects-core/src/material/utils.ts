import * as spec from '@galacean/effects-specification';
import { glContext } from '../gl';
import { MaskMode } from './types';
import type { Material } from './material';

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

export function setBlendMode (material: Material, blendMode?: number) {
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
      console.warn(`BlendMode ${blendMode} not in specification, please set blend params separately.`);
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

export function setMaskMode (material: Material, maskMode: MaskMode, colorMask: boolean = false) {
  switch (maskMode) {
    case undefined:
      material.stencilTest = false;

      break;
    case MaskMode.MASK:
      material.stencilTest = true;
      material.stencilFunc = [glContext.ALWAYS, glContext.ALWAYS];
      material.stencilOpZPass = [glContext.REPLACE, glContext.REPLACE];
      // 关闭/开启蒙版元素的颜色写入
      material.colorMask = [colorMask, colorMask, colorMask, colorMask];

      break;
    case MaskMode.OBSCURED:
      material.stencilTest = true;
      material.stencilFunc = [glContext.EQUAL, glContext.EQUAL];

      break;
    case MaskMode.REVERSE_OBSCURED:
      material.stencilTest = true;
      material.stencilFunc = [glContext.NOTEQUAL, glContext.NOTEQUAL];

      break;
    case MaskMode.NONE:
      material.stencilTest = false;

      break;
    default:
      console.warn(`MaskMode ${maskMode} not in specification, please set stencil params seperately.`);
  }
}
