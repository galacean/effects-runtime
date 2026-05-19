import type { CurveResult, ProcessCurveContext } from '../model';
import { CurveEffects } from '../model';

export class Boost extends CurveEffects {
  intensity = 1.0; // 0 ~ 1

  constructor () {
    super();
    this.name = 'Boost';
  }

  /**
   * 按比例整体放大 value 与 slope。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;
    const intensity = this.intensity;

    for (const k of base) {
      k.value = k.value * intensity;
      k.inSlope = k.inSlope * intensity;
      k.outSlope = k.outSlope * intensity;
    }
  }
}

export class Increase extends CurveEffects {
  intensity = 1.0; // 0 ~ 1

  constructor () {
    super();
    this.name = 'Increase';
  }

  /**
   * 对 value 与 slope 施加固定偏移。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;
    const intensity = this.intensity;

    for (const k of base) {
      k.value = k.value + intensity;
      k.inSlope = k.inSlope + intensity;
      k.outSlope = k.outSlope + intensity;
    }
  }
}

export class Attenuation extends CurveEffects {
  intensity = 1.0; // 0 ~ 1

  constructor () {
    super();
    this.name = 'Attenuation';
  }

  /**
   * 随时间衰减：time 越靠后，value 衰减越明显。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;
    const intensity = this.intensity;

    for (const k of base) {
      k.value = k.value * (1 - intensity * k.time);
      k.inSlope = k.inSlope * (1 - intensity);
      k.outSlope = k.outSlope * (1 - intensity);
    }
  }
}

export class Gain extends CurveEffects {
  intensity = 1.0; // 0 ~ 1

  constructor () {
    super();
    this.name = 'Gain';
  }

  /**
   * 随时间增益：time 越靠后，value 增益越明显。
   */
  override processCurve (context: ProcessCurveContext, result: CurveResult) {
    const base = result.keyFrames;
    const intensity = this.intensity;

    for (const k of base) {
      k.value = k.value * (1 + intensity * k.time);
      k.inSlope = k.inSlope * (1 + intensity);
      k.outSlope = k.outSlope * (1 + intensity);
    }
  }
}
