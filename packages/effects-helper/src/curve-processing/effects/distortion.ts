import type { CurveResult, ProcessCurveContext } from '../model';
import { CurveEffects } from '../model';

export class Distortion extends CurveEffects {
  intensity = 1.0; // 0 ~ 1
  density = 1.0; // 0 ~ 1

  constructor () {
    super();
    this.name = 'Distortion';
  }

  /**
   * 按时间采样噪声，对 value 与 slope 同步施加扰动。
   *
   * 扰动幅度会参考 valueRange 与 timeRange 缩放，避免曲线范围变化时失真过大或过小。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;

    if (!base.length) {
      return;
    }

    const intensity = this.intensity;

    let minValue = Infinity;
    let maxValue = -Infinity;

    for (const k of base) {
      minValue = Math.min(minValue, k.value);
      maxValue = Math.max(maxValue, k.value);
    }
    const valueRange = Math.max(Math.abs(maxValue - minValue), 0.0001);

    // 组合多频正弦构造可复现的伪随机噪声。
    const noise = (x: number) => {
      const noise1 = Math.sin(x * 12.9898 + 78.233);
      const noise2 = Math.sin(x * 25.7896 + 156.466);
      const combined = (noise1 * 0.7 + noise2 * 0.3) * 43758.5453;

      return combined - Math.floor(combined);
    };

    const timeRange = Math.max(base[base.length - 1].time - base[0].time, Number.EPSILON);

    for (const k of base) {
      const distortion = (noise(k.time * this.density) - 0.5) * 2 * intensity * (valueRange * 0.1);

      k.value = k.value + distortion;

      const slopeDistortion = (noise((k.time + 123.456) * this.density) - 0.5) * 2 * intensity
        * (valueRange / timeRange)
        * 0.1;

      k.inSlope = k.inSlope + slopeDistortion;
      k.outSlope = k.outSlope + slopeDistortion;
    }
  }
}
