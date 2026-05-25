import { ProDistributionFloat } from './pro-distribution-float';

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

  sampleAtTime (random: number, t: number, out?: [number, number, number, number]): [number, number, number, number] {
    const result = out ?? [0, 0, 0, 0];

    result[0] = this.r.sampleAtTime(random, t);
    result[1] = this.g.sampleAtTime(random, t);
    result[2] = this.b.sampleAtTime(random, t);
    result[3] = this.a.sampleAtTime(random, t);

    return result;
  }
}
