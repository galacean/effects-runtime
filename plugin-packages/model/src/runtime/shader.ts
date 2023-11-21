import { PMaterialType } from './common';
import type { PMaterialBase } from './material';
import * as Helper from '../utility/shader-helper';

export interface PShaderContext {
  material: PMaterialBase,
  isWebGL2: boolean,
  featureList: string[],
}

export interface PShaderResults {
  vertexShaderCode: string,
  fragmentShaderCode: string,
}

export type ShaderCodeFuncType = (context: PShaderContext) => PShaderResults;

export class PShaderManager {
  private funcMap: Map<PMaterialType, ShaderCodeFuncType>;
  private static _instance: PShaderManager;

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

