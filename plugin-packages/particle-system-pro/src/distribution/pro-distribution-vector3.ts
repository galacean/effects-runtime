import { ProDistributionFloat } from './pro-distribution-float';

/**
 * 三维向量 Distribution。每个轴独立或统一（uniform）采样。
 *
 * uniform=true 时三轴共用同一个 random 值（用于等比缩放等场景）。
 */
export class ProDistributionVector3 {
  x: ProDistributionFloat;
  y: ProDistributionFloat;
  z: ProDistributionFloat;
  uniform: boolean;

  constructor (x: ProDistributionFloat, y: ProDistributionFloat, z: ProDistributionFloat, uniform = false) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.uniform = uniform;
  }

  static fromConstant (x: number, y: number, z: number): ProDistributionVector3 {
    return new ProDistributionVector3(
      ProDistributionFloat.fromConstant(x),
      ProDistributionFloat.fromConstant(y),
      ProDistributionFloat.fromConstant(z),
    );
  }

  static fromRange (min: [number, number, number], max: [number, number, number], uniform = false): ProDistributionVector3 {
    return new ProDistributionVector3(
      ProDistributionFloat.fromRange(min[0], max[0]),
      ProDistributionFloat.fromRange(min[1], max[1]),
      ProDistributionFloat.fromRange(min[2], max[2]),
      uniform,
    );
  }

  toJSON () {
    return {
      x: this.x.toJSON(),
      y: this.y.toJSON(),
      z: this.z.toJSON(),
      uniform: this.uniform,
    };
  }

  static fromJSON (data: ReturnType<ProDistributionVector3['toJSON']>): ProDistributionVector3 {
    return new ProDistributionVector3(
      ProDistributionFloat.fromJSON(data.x),
      ProDistributionFloat.fromJSON(data.y),
      ProDistributionFloat.fromJSON(data.z),
      !!data.uniform,
    );
  }

  sampleAtTime (random: number, t: number, out?: [number, number, number]): [number, number, number] {
    const result = out ?? [0, 0, 0];

    if (this.uniform) {
      result[0] = this.x.sampleAtTime(random, t);
      result[1] = this.y.sampleAtTime(random, t);
      result[2] = this.z.sampleAtTime(random, t);
    } else {
      result[0] = this.x.sampleAtTime(random, t);
      result[1] = this.y.sampleAtTime(random, t);
      result[2] = this.z.sampleAtTime(random, t);
    }

    return result;
  }
}
