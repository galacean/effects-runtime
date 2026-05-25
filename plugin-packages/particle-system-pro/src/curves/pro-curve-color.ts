import { ProCurveFloat } from './pro-curve-float';
import type { ProKeyframe } from './pro-keyframe';

/**
 * 四通道颜色曲线（RGBA 各一条 ProCurveFloat）。
 *
 * evaluate(t) 返回 [r, g, b, a]，t ∈ [0, 1]。
 * 对齐 UE NiagaraDataInterfaceColorCurve。
 */
export class ProCurveColor {
  r: ProCurveFloat;
  g: ProCurveFloat;
  b: ProCurveFloat;
  a: ProCurveFloat;

  constructor (r: ProCurveFloat, g: ProCurveFloat, b: ProCurveFloat, a: ProCurveFloat) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static constant (r: number, g: number, b: number, a: number): ProCurveColor {
    return new ProCurveColor(
      ProCurveFloat.constant(r),
      ProCurveFloat.constant(g),
      ProCurveFloat.constant(b),
      ProCurveFloat.constant(a),
    );
  }

  static linear (start: [number, number, number, number], end: [number, number, number, number]): ProCurveColor {
    return new ProCurveColor(
      ProCurveFloat.linear(start[0], end[0]),
      ProCurveFloat.linear(start[1], end[1]),
      ProCurveFloat.linear(start[2], end[2]),
      ProCurveFloat.linear(start[3], end[3]),
    );
  }

  static fromKeyframes (rKeys: ProKeyframe[], gKeys: ProKeyframe[], bKeys: ProKeyframe[], aKeys: ProKeyframe[]): ProCurveColor {
    return new ProCurveColor(
      ProCurveFloat.fromKeyframes(rKeys),
      ProCurveFloat.fromKeyframes(gKeys),
      ProCurveFloat.fromKeyframes(bKeys),
      ProCurveFloat.fromKeyframes(aKeys),
    );
  }

  toJSON () {
    return {
      r: this.r.toJSON(),
      g: this.g.toJSON(),
      b: this.b.toJSON(),
      a: this.a.toJSON(),
    };
  }

  static fromJSON (data: { r: { keyframes: ProKeyframe[] }, g: { keyframes: ProKeyframe[] }, b: { keyframes: ProKeyframe[] }, a: { keyframes: ProKeyframe[] } }): ProCurveColor {
    return new ProCurveColor(
      ProCurveFloat.fromJSON(data.r),
      ProCurveFloat.fromJSON(data.g),
      ProCurveFloat.fromJSON(data.b),
      ProCurveFloat.fromJSON(data.a),
    );
  }

  evaluate (t: number, out?: [number, number, number, number]): [number, number, number, number] {
    const result = out ?? [0, 0, 0, 0];

    result[0] = this.r.evaluate(t);
    result[1] = this.g.evaluate(t);
    result[2] = this.b.evaluate(t);
    result[3] = this.a.evaluate(t);

    return result;
  }
}
