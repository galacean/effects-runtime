import { ProDistributionFloat } from './pro-distribution-float';

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

  sampleAtTime (random: number, t: number, out?: [number, number]): [number, number] {
    const result = out ?? [0, 0];

    result[0] = this.x.sampleAtTime(random, t);
    result[1] = this.y.sampleAtTime(random, t);

    return result;
  }
}
