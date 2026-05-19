import type { CurveResult, Keyframe, ProcessCurveContext } from '../model';
import { CurveEffects, TangentMode, WeightedMode } from '../model';

function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sortByTime (keyframes: Keyframe[]): Keyframe[] {
  return keyframes.slice().sort((a, b) => a.time - b.time);
}

function getLinearInterpolatedKeyframe (frame1: Keyframe, frame2: Keyframe, time: number, normalizedTime: number): Keyframe {
  return {
    time,
    value: frame1.value + (frame2.value - frame1.value) * normalizedTime,
    inSlope: frame1.inSlope,
    outSlope: frame1.outSlope,
    inWeight: frame1.inWeight,
    outWeight: frame1.outWeight,
    weightedMode: frame1.weightedMode,
    tangentMode: frame1.tangentMode,
  };
}

function solveBezierT (
  p0x: number,
  p1x: number,
  p2x: number,
  p3x: number,
  x: number,
  epsilon = 1e-7,
  maxIterations = 12,
): number {
  // 通过牛顿迭代求解 x(t)=x 对应的参数 t。
  const denominator = p3x - p0x;
  let t = Math.abs(denominator) < Number.EPSILON ? 0 : (x - p0x) / denominator;

  t = clamp(t, 0, 1);

  for (let i = 0; i < maxIterations; i++) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const fx = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x - x;

    if (Math.abs(fx) < epsilon) {
      break;
    }

    const dx = -3 * mt2 * p0x +
      3 * mt2 * p1x -
      6 * mt * t * p1x -
      3 * t2 * p2x +
      6 * mt * t * p2x +
      3 * t2 * p3x;

    if (Math.abs(dx) < epsilon) {
      break;
    }

    t = clamp(t - fx / dx, 0, 1);
  }

  return t;
}

function getCubicInterpolatedKeyframe (frame1: Keyframe, frame2: Keyframe, time: number, dt: number): Keyframe {
  // 先构造原三次贝塞尔控制点，再在给定 time 处反解并重建局部切线与权重。
  const p0x = frame1.time;
  const p0y = frame1.value;
  const p3x = frame2.time;
  const p3y = frame2.value;
  const oneThirdDt = dt / 3;

  const p1x = p0x + oneThirdDt * frame1.outWeight;
  const p1y = p0y + frame1.outSlope * oneThirdDt * frame1.outWeight;
  const p2x = p3x - oneThirdDt * frame2.inWeight;
  const p2y = p3y - frame2.inSlope * oneThirdDt * frame2.inWeight;

  const t = solveBezierT(p0x, p1x, p2x, p3x, time, 1e-7, 12);

  const mt = 1 - t;
  const t2 = t * t;
  const t3 = t2 * t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  const value = mt3 * p0y +
    3 * mt2 * t * p1y +
    3 * mt * t2 * p2y +
    t3 * p3y;

  const p01x = p0x * mt + p1x * t;
  const p01y = p0y * mt + p1y * t;
  const p12x = p1x * mt + p2x * t;
  const p12y = p1y * mt + p2y * t;
  const p23x = p2x * mt + p3x * t;
  const p23y = p2y * mt + p3y * t;

  const p012x = p01x * mt + p12x * t;
  const p012y = p01y * mt + p12y * t;
  const p123x = p12x * mt + p23x * t;
  const p123y = p12y * mt + p23y * t;

  const leftDt = time - p0x;
  const rightDt = p3x - time;
  const leftOneThird = leftDt / 3;
  const rightOneThird = rightDt / 3;
  const slopeDenominator = p123x - p012x;
  const inSlope = Math.abs(slopeDenominator) < Number.EPSILON ? 0 : (p123y - p012y) / slopeDenominator;
  const outSlope = inSlope;

  const inWeight = Math.abs(leftOneThird) < Number.EPSILON ? 0.33 : Math.abs(p012x - time) / leftOneThird;
  const outWeight = Math.abs(rightOneThird) < Number.EPSILON ? 0.33 : Math.abs(p123x - time) / rightOneThird;

  return {
    time,
    value,
    inSlope,
    outSlope,
    inWeight: clamp(inWeight, 0.01, 1),
    outWeight: clamp(outWeight, 0.01, 1),
    weightedMode: WeightedMode.Both,
    tangentMode: TangentMode.Cubic,
  };
}

export class Resampler extends CurveEffects {
  sampleCount = 50;

  constructor () {
    super();
    this.name = 'Resampler';
  }

  /**
   * 按固定 sampleCount 对曲线进行重采样。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;

    if (!base.length) {
      return;
    }

    const sampleCount = Math.max(2, Math.floor(this.sampleCount));
    const resultKeyframes: Keyframe[] = [];
    const sortedFrames = sortByTime(base);

    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1);

      resultKeyframes.push(this.getKeyframeAtTime(sortedFrames, t));
    }

    result.keyFrames = resultKeyframes;
  }

  /**
   * 计算指定 time 下的关键帧，兼容 Constant/Linear/Cubic 三种切线模式。
   */
  private getKeyframeAtTime (keyframes: Keyframe[], time: number): Keyframe {
    if (!keyframes.length) {
      throw new Error('Keyframes array is empty');
    }

    time = clamp(time, 0, 1);
    const sortedFrames = keyframes;

    if (time <= sortedFrames[0].time) {
      return { ...sortedFrames[0] };
    }
    if (time >= sortedFrames[sortedFrames.length - 1].time) {
      return { ...sortedFrames[sortedFrames.length - 1] };
    }

    let frame1: Keyframe | null = null;
    let frame2: Keyframe | null = null;

    // 定位 time 所在的相邻关键帧区间。
    for (let i = 0; i < sortedFrames.length - 1; i++) {
      if (time >= sortedFrames[i].time && time <= sortedFrames[i + 1].time) {
        frame1 = sortedFrames[i];
        frame2 = sortedFrames[i + 1];

        break;
      }
    }

    if (!frame1 || !frame2) {
      throw new Error('Failed to find surrounding keyframes');
    }

    const dt = frame2.time - frame1.time;

    if (Math.abs(dt) < Number.EPSILON) {
      return { ...frame1, time };
    }

    const normalizedTime = (time - frame1.time) / dt;

    if (frame1.tangentMode === TangentMode.Constant) {
      return { ...frame1 };
    } else if (frame1.tangentMode === TangentMode.Linear) {
      return getLinearInterpolatedKeyframe(frame1, frame2, time, normalizedTime);
    } else {
      return getCubicInterpolatedKeyframe(frame1, frame2, time, dt);
    }
  }
}
