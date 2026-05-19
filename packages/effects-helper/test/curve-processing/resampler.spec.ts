import { describe, expect, it } from 'vitest';
import { CurveResult, TangentMode, WeightedMode, Resampler } from '@galacean/effects-helper';
import type { Keyframe } from '@galacean/effects-helper';

function createKeyframe (partial: Partial<Keyframe> & Pick<Keyframe, 'time' | 'value'>): Keyframe {
  return {
    time: partial.time,
    value: partial.value,
    inSlope: partial.inSlope ?? 0,
    outSlope: partial.outSlope ?? 0,
    inWeight: partial.inWeight ?? 0.33,
    outWeight: partial.outWeight ?? 0.33,
    weightedMode: partial.weightedMode ?? WeightedMode.Both,
    tangentMode: partial.tangentMode ?? TangentMode.Cubic,
  };
}

describe('curve-processing/resampler', () => {
  it('keeps result unchanged when input keyframes are empty', () => {
    const resampler = new Resampler();
    const result = new CurveResult();

    result.keyFrames = [];
    resampler.processCurve({} as never, result);

    expect(result.keyFrames).toEqual([]);
  });

  it('clamps sampleCount to at least 2', () => {
    const resampler = new Resampler();
    const result = new CurveResult();

    resampler.sampleCount = 1;
    result.keyFrames = [
      createKeyframe({ time: 0, value: 0, tangentMode: TangentMode.Linear }),
      createKeyframe({ time: 1, value: 10, tangentMode: TangentMode.Linear }),
    ];

    resampler.processCurve({} as never, result);

    expect(result.keyFrames).toHaveLength(2);
    expect(result.keyFrames[0].time).toBe(0);
    expect(result.keyFrames[1].time).toBe(1);
  });

  it('resamples linear keyframes with expected midpoint value', () => {
    const resampler = new Resampler();
    const result = new CurveResult();

    resampler.sampleCount = 3;
    result.keyFrames = [
      createKeyframe({ time: 0, value: 0, tangentMode: TangentMode.Linear }),
      createKeyframe({ time: 1, value: 10, tangentMode: TangentMode.Linear }),
    ];

    resampler.processCurve({} as never, result);

    expect(result.keyFrames).toHaveLength(3);
    expect(result.keyFrames[1].time).toBeCloseTo(0.5, 6);
    expect(result.keyFrames[1].value).toBeCloseTo(5, 6);
  });

  it('uses previous keyframe value for constant segment', () => {
    const resampler = new Resampler();
    const result = new CurveResult();

    resampler.sampleCount = 3;
    result.keyFrames = [
      createKeyframe({ time: 0, value: 2, tangentMode: TangentMode.Constant }),
      createKeyframe({ time: 1, value: 8, tangentMode: TangentMode.Linear }),
    ];

    resampler.processCurve({} as never, result);

    expect(result.keyFrames[1].value).toBe(2);
  });

  it('does not throw on duplicate keyframe times', () => {
    const resampler = new Resampler();
    const result = new CurveResult();

    resampler.sampleCount = 5;
    result.keyFrames = [
      createKeyframe({ time: 0, value: 1, tangentMode: TangentMode.Cubic }),
      createKeyframe({ time: 0, value: 1.5, tangentMode: TangentMode.Cubic }),
      createKeyframe({ time: 1, value: 3, tangentMode: TangentMode.Cubic }),
    ];

    expect(() => resampler.processCurve({} as never, result)).not.toThrow();
    expect(result.keyFrames.every(keyframe => Number.isFinite(keyframe.value))).toBe(true);
  });
});
