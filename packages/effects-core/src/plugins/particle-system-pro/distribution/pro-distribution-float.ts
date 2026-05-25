import { ProCurveFloat } from '../curves/pro-curve-float';

export type ProDistributionMode = 'constant' | 'range' | 'curve';

/**
 * 统一参数输入：支持 Constant / Range(min,max) / Curve 三种模式。
 *
 * 对齐 UE Niagara Stateless 的 FNiagaraDistributionFloat。
 * - constant: 固定值
 * - range: per-particle 随机采样 [min, max]
 * - curve: 按 normalizedAge 等参数采样曲线
 */
export class ProDistributionFloat {
  mode: ProDistributionMode;
  constant: number;
  min: number;
  max: number;
  curve: ProCurveFloat;

  private constructor (mode: ProDistributionMode, constant: number, min: number, max: number, curve: ProCurveFloat) {
    this.mode = mode;
    this.constant = constant;
    this.min = min;
    this.max = max;
    this.curve = curve;
  }

  static fromConstant (value: number): ProDistributionFloat {
    return new ProDistributionFloat('constant', value, value, value, ProCurveFloat.constant(value));
  }

  static fromRange (min: number, max: number): ProDistributionFloat {
    return new ProDistributionFloat('range', min, min, max, ProCurveFloat.constant(min));
  }

  static fromCurve (curve: ProCurveFloat): ProDistributionFloat {
    return new ProDistributionFloat('curve', 0, 0, 1, curve);
  }

  /**
   * 统一采样入口。
   * - constant: 返回 constant
   * - range: 返回 min + random * (max - min)
   * - curve: 返回 curve.evaluate(t)
   */
  sampleAtTime (random: number, t: number): number {
    switch (this.mode) {
      case 'constant': return this.constant;
      case 'range': return this.min + random * (this.max - this.min);
      case 'curve': return this.curve.evaluate(t);
    }
  }
}
