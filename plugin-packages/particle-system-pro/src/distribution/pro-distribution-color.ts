import { ProDistributionFloat } from './pro-distribution-float';
import type { ProDistributionFloatData } from './pro-distribution-float';
import type { ProCurveColor } from '../curves/pro-curve-color';

export interface ProDistributionColorData {
  r: ProDistributionFloatData,
  g: ProDistributionFloatData,
  b: ProDistributionFloatData,
  a: ProDistributionFloatData,
}

/**
 * 四通道颜色 Distribution (RGBA)。每通道独立采样。
 */
export class ProDistributionColor {
  r: ProDistributionFloat;
  g: ProDistributionFloat;
  b: ProDistributionFloat;
  a: ProDistributionFloat;

  constructor (r: ProDistributionFloat, g: ProDistributionFloat, b: ProDistributionFloat, a: ProDistributionFloat) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static fromConstant (r: number, g: number, b: number, a: number): ProDistributionColor {
    return new ProDistributionColor(
      ProDistributionFloat.fromConstant(r),
      ProDistributionFloat.fromConstant(g),
      ProDistributionFloat.fromConstant(b),
      ProDistributionFloat.fromConstant(a),
    );
  }

  static fromRange (
    min: [number, number, number, number],
    max: [number, number, number, number],
  ): ProDistributionColor {
    return new ProDistributionColor(
      ProDistributionFloat.fromRange(min[0], max[0]),
      ProDistributionFloat.fromRange(min[1], max[1]),
      ProDistributionFloat.fromRange(min[2], max[2]),
      ProDistributionFloat.fromRange(min[3], max[3]),
    );
  }

  /**
   * 从 ProCurveColor（4 条独立曲线）构造 — 每通道走 Curve distribution，t = normalizedAge。
   * 用于"按生命周期沿曲线 fade"场景：ScaleColor 配合本工厂可代替已删除的 ColorOverLife
   */
  static fromCurve (curve: ProCurveColor): ProDistributionColor {
    return new ProDistributionColor(
      ProDistributionFloat.fromCurve(curve.r),
      ProDistributionFloat.fromCurve(curve.g),
      ProDistributionFloat.fromCurve(curve.b),
      ProDistributionFloat.fromCurve(curve.a),
    );
  }

  toJSON (): ProDistributionColorData {
    return {
      r: this.r.toJSON(),
      g: this.g.toJSON(),
      b: this.b.toJSON(),
      a: this.a.toJSON(),
    };
  }

  static fromJSON (data: ProDistributionColorData): ProDistributionColor {
    return new ProDistributionColor(
      ProDistributionFloat.fromJSON(data.r),
      ProDistributionFloat.fromJSON(data.g),
      ProDistributionFloat.fromJSON(data.b),
      ProDistributionFloat.fromJSON(data.a),
    );
  }

  sampleAtTime (random: number, t: number, out?: [number, number, number, number]): [number, number, number, number] {
    const result = out ?? [0, 0, 0, 0];

    result[0] = this.r.sampleAtTime(random, t);
    result[1] = this.g.sampleAtTime(random, t);
    result[2] = this.b.sampleAtTime(random, t);
    result[3] = this.a.sampleAtTime(random, t);

    return result;
  }
}
