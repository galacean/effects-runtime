import type { CurveResult, Keyframe, ProcessCurveContext } from '../model';
import { CurveEffects } from '../model';

export class Looper extends CurveEffects {
  loopCount = 1;

  constructor () {
    super();
    this.name = 'Looper';
  }

  /**
   * 将一段曲线复制为多轮循环，并压缩回 [0, 1] 时间范围。
   *
   * 斜率按 loopCount 放大，用于抵消时间压缩带来的形态变化。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;

    if (!base.length) {
      return;
    }

    const loopCount = Math.max(1, Math.floor(this.loopCount));
    const resultKeyframes: Keyframe[] = [];

    for (let loopIndex = 0; loopIndex < loopCount; loopIndex++) {
      const tOffset = loopIndex / loopCount;
      const tScale = 1 / loopCount;

      for (let i = 0; i < base.length; i++) {
        // 后续轮次跳过首帧，避免循环拼接点重复。
        if (loopIndex > 0 && i === 0) {
          continue;
        }

        const src = base[i];

        resultKeyframes.push({
          time: src.time * tScale + tOffset,
          value: src.value,
          inSlope: src.inSlope * loopCount,
          outSlope: src.outSlope * loopCount,
          inWeight: src.inWeight,
          outWeight: src.outWeight,
          weightedMode: src.weightedMode,
          tangentMode: src.tangentMode,
        });
      }
    }

    result.keyFrames = resultKeyframes;
  }
}
