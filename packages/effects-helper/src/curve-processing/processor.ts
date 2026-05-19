import type { spec } from '@galacean/effects';
import type { CurveEffects, Keyframe } from './model';
import { CurveResult, ProcessCurveContext } from './model';
import { Distortion, Looper, Resampler, Boost, Increase } from './effects';
import { newBezierKeyframesToOld } from './bezier-conversion';

export type CurveParameter = {
  intensity: number,
  loopCount: number,
  noise: number,
  increase?: number,
};

/**
 * 可组合的曲线处理流水线。
 *
 * 输入：运行时 Keyframe[]
 * 输出：规范格式 spec.BezierKeyframeValue[]
 */
export class CurveEffectsProcessor {
  effects: CurveEffects[] = [];
  private context = new ProcessCurveContext();

  /**
   * 在流水线尾部注册一个新的 effect 实例。
   * effect 的执行顺序与注册顺序严格一致。
   */
  addEffects<T extends CurveEffects> (effects: new () => T): T {
    const newEffects = new effects();

    this.effects.push(newEffects);

    return newEffects;
  }

  constructor (curveParameter?: CurveParameter) {
    // 默认链路：振幅调整 -> 密度重建 -> 扰动 -> 循环时间重映射。
    const boost = this.addEffects(Boost);
    const increase = this.addEffects(Increase);
    const resampler = this.addEffects(Resampler);
    const distortion = this.addEffects(Distortion);
    const looper = this.addEffects(Looper);

    if (curveParameter) {
      boost.intensity = curveParameter.intensity;
      looper.loopCount = curveParameter.loopCount;
      distortion.intensity = curveParameter.noise;

      if (curveParameter.noise === 0) {
        // 噪声关闭时跳过相关阶段，减少不必要计算。
        resampler.enabled = false;
        distortion.enabled = false;
      }

      if (curveParameter.increase === undefined) {
        increase.enabled = false;
      }
    }
  }

  /**
   * 执行所有启用 effect，并回写为规范 Bezier 关键帧。
   *
   * 会先浅拷贝输入，避免直接修改调用方持有的数组。
   */
  processCurve (keyframes: Keyframe[]): spec.BezierKeyframeValue[] {
    const result = new CurveResult();

    result.keyFrames = keyframes.map(keyframe => ({ ...keyframe }));

    for (const effector of this.effects) {
      if (effector.enabled) {
        effector.processCurve(this.context, result);
      }
    }

    return newBezierKeyframesToOld(result.keyFrames);
  }
}
