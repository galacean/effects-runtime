import { ProDistributionFloat } from './pro-distribution-float';
import type { ProDistributionFloatData } from './pro-distribution-float';
import type { ProCurveFloat } from '../curves/pro-curve-float';

export interface ProDistributionVector2Data {
  x: ProDistributionFloatData,
  y: ProDistributionFloatData,
  uniform: boolean,
}

/**
 * 二维向量 Distribution。每个轴独立采样。用于 Sprite size (X/Y) 等场景。
 *
 * uniform=true 时两轴共用同一个 random 值（等比变化）。
 */
export class ProDistributionVector2 {
  x: ProDistributionFloat;
  y: ProDistributionFloat;
  uniform: boolean;

  constructor (x: ProDistributionFloat, y: ProDistributionFloat, uniform = false) {
    this.x = x;
    this.y = y;
    this.uniform = uniform;
  }

  static fromConstant (x: number, y: number): ProDistributionVector2 {
    return new ProDistributionVector2(
      ProDistributionFloat.fromConstant(x),
      ProDistributionFloat.fromConstant(y),
    );
  }

  static fromUniformConstant (v: number): ProDistributionVector2 {
    return new ProDistributionVector2(
      ProDistributionFloat.fromConstant(v),
      ProDistributionFloat.fromConstant(v),
      true,
    );
  }

  static fromRange (min: [number, number], max: [number, number], uniform = false): ProDistributionVector2 {
    return new ProDistributionVector2(
      ProDistributionFloat.fromRange(min[0], max[0]),
      ProDistributionFloat.fromRange(min[1], max[1]),
      uniform,
    );
  }

  /**
   * X / Y 各从一条独立 ProCurveFloat 构造 — 用于"按生命周期沿曲线缩放"场景。
   * 配合 ScaleSpriteSize 代替已删除的 SizeOverLife
   */
  static fromCurves (curveX: ProCurveFloat, curveY: ProCurveFloat): ProDistributionVector2 {
    return new ProDistributionVector2(
      ProDistributionFloat.fromCurve(curveX),
      ProDistributionFloat.fromCurve(curveY),
    );
  }

  toJSON (): ProDistributionVector2Data {
    return {
      x: this.x.toJSON(),
      y: this.y.toJSON(),
      uniform: this.uniform,
    };
  }

  static fromJSON (data: ProDistributionVector2Data): ProDistributionVector2 {
    return new ProDistributionVector2(
      ProDistributionFloat.fromJSON(data.x),
      ProDistributionFloat.fromJSON(data.y),
      !!data.uniform,
    );
  }

  sampleAtTime (random: number, t: number, out?: [number, number]): [number, number] {
    const result = out ?? [0, 0];

    result[0] = this.x.sampleAtTime(random, t);
    result[1] = this.y.sampleAtTime(random, t);

    return result;
  }
}
