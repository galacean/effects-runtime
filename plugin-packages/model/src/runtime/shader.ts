import { PMaterialType } from './common';
import type { PMaterialBase } from './material';
import * as Helper from '../utility/shader-helper';

/**
 * 着色器上下文
 */
export interface PShaderContext {
  /**
   * 材质
   */
  material: PMaterialBase,
  /**
   * 是否 WebGL2
   */
  isWebGL2: boolean,
  /**
   * 特性列表
   */
  featureList: string[],
}

/**
 * 着色器返回的代码结果
 */
export interface PShaderResults {
  /**
   * 顶点着色器代码
   */
  vertexShaderCode: string,
  /**
   * 片段着色器代码
   */
  fragmentShaderCode: string,
}

type ShaderCodeFuncType = (context: PShaderContext) => PShaderResults;

/**
 * 着色器管理类
 */
export class PShaderManager {
  private funcMap: Map<PMaterialType, ShaderCodeFuncType>;
  private static _instance: PShaderManager;

  /**
   * 获取着色器单例对象
   * @returns
   */
  static getInstance (): PShaderManager {
    // Do you need arguments? Make it a regular static method instead.
    return this._instance || (this._instance = new this());
  }

  private constructor () {
    this.funcMap = new Map();
    this.funcMap.set(PMaterialType.unlit, Helper.getPBRPassShaderCode);
    this.funcMap.set(PMaterialType.pbr, Helper.getPBRPassShaderCode);
    this.funcMap.set(PMaterialType.shadowBase, Helper.getShadowPassShaderCode);
    this.funcMap.set(PMaterialType.shadowFilter, Helper.getGaussianBlurShaderCodeV2);
    this.funcMap.set(PMaterialType.normalVis, Helper.getNormalVisShaderCode);
    this.funcMap.set(PMaterialType.simpleFilter, Helper.getSimpleFilterShaderCode);
    this.funcMap.set(PMaterialType.skyboxFilter, Helper.getSkyBoxShaderCode);
  }

  /**
   * 生成着色器代码
   * @param context - 着色器上下文
   * @returns
   */
  genShaderCode (context: PShaderContext): PShaderResults {
    const materialType = context.material.materialType;
    const func = this.funcMap.get(materialType);

    if (func !== undefined) {
      return func(context);
    } else {
      throw new Error(`Invalid material type ${materialType}, shader content ${context}`);
    }
  }
}
