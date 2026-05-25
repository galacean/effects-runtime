import type { ProKeyframe, ProInterpMode } from './pro-keyframe';

/**
 * 轻量浮点曲线，支持三种模式：
 * - 常量（1 关键帧）
 * - 线性（2 关键帧，linear 插值）
 * - 完整曲线（N 关键帧，Hermite 插值）
 *
 * evaluate(t) 中 t ∈ [0, 1]。
 * 对齐 UE NiagaraDataInterfaceCurve 的运行时采样行为。
 */
export class ProCurveFloat {
  keyframes: ProKeyframe[];

  private constructor (keyframes: ProKeyframe[]) {
    this.keyframes = keyframes;
  }

  static constant (value: number): ProCurveFloat {
    return new ProCurveFloat([{ time: 0, value, inTangent: 0, outTangent: 0, interpMode: 'linear' }]);
  }

  static linear (start: number, end: number): ProCurveFloat {
    return new ProCurveFloat([
      { time: 0, value: start, inTangent: 0, outTangent: end - start, interpMode: 'linear' },
      { time: 1, value: end, inTangent: end - start, outTangent: 0, interpMode: 'linear' },
    ]);
  }

  static fromKeyframes (keyframes: ProKeyframe[]): ProCurveFloat {
    if (keyframes.length === 0) {
      return ProCurveFloat.constant(0);
    }

    return new ProCurveFloat([...keyframes].sort((a, b) => a.time - b.time));
  }

  toJSON (): { keyframes: ProKeyframe[] } {
    return { keyframes: this.keyframes.map(k => ({ ...k })) };
  }

  static fromJSON (data: { keyframes: ProKeyframe[] }): ProCurveFloat {
    return ProCurveFloat.fromKeyframes(data.keyframes ?? []);
  }

  evaluate (t: number): number {
    const keys = this.keyframes;
    const len = keys.length;

    if (len === 0) { return 0; }
    if (len === 1) { return keys[0].value; }

    if (t <= keys[0].time) { return keys[0].value; }
    if (t >= keys[len - 1].time) { return keys[len - 1].value; }

    // Binary search for the segment
    let lo = 0;
    let hi = len - 1;

    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;

      if (keys[mid].time <= t) { lo = mid; } else { hi = mid; }
    }

    const k0 = keys[lo];
    const k1 = keys[hi];
    const dt = k1.time - k0.time;

    if (dt <= 0) { return k0.value; }

    const s = (t - k0.time) / dt;

    return interpolateSegment(k0, k1, s, dt);
  }
}

function interpolateSegment (k0: ProKeyframe, k1: ProKeyframe, s: number, dt: number): number {
  const mode: ProInterpMode = k0.interpMode;

  if (mode === 'constant') {
    return k0.value;
  }
  if (mode === 'linear') {
    return k0.value + (k1.value - k0.value) * s;
  }
  // Cubic Hermite interpolation (same as Unity AnimationCurve)
  const p0 = k0.value;
  const p1 = k1.value;
  const m0 = k0.outTangent * dt;
  const m1 = k1.inTangent * dt;

  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
}
