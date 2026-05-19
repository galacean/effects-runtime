export enum TangentMode {
  Cubic = 0,
  Linear = 1,
  Constant = 2,
}

export enum WeightedMode {
  None = 0,
  In = 1,
  Out = 2,
  Both = 3,
}

export type Keyframe = {
  // 归一化时间轴，处理阶段通常位于 [0, 1]。
  time: number,
  // 当前关键帧上的标量值。
  value: number,
  // 三次插值使用的入/出切线斜率。
  inSlope: number,
  outSlope: number,
  // 左/右两侧贝塞尔手柄相对权重。
  inWeight: number,
  outWeight: number,
  weightedMode: WeightedMode,
  tangentMode: TangentMode,
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ProcessCurveContext {
}

export class CurveResult {
  // 单次处理流程共享的可变关键帧缓冲区。
  keyFrames: Keyframe[] = [];
}

export class CurveEffects {
  name = 'NewCurveEffects';
  enabled = true;

  /**
   * 对关键帧缓冲区应用 effect 逻辑。
   * 子类可原地修改 `result.keyFrames`，也可整体替换。
   */
  processCurve (context: ProcessCurveContext, result: CurveResult) {
    // Override in subclass
  }
}
