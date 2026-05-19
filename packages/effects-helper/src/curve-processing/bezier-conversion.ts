import { math, spec } from '@galacean/effects';
import type { Keyframe } from './model';
import { TangentMode } from './model';

export type Vector2Like = {
  x: number,
  y: number,
};

/**
 * 将运行时关键帧转换为规范 Bezier 关键帧。
 *
 * 通常用于所有运行时 effect 处理完成后的最终回写步骤。
 */
export function newBezierKeyframesToOld (keyframes: Keyframe[]): spec.BezierKeyframeValue[] {
  if (!keyframes.length) {
    return [];
  }

  const res: spec.BezierKeyframeValue[] = [];

  for (let i = 0; i < keyframes.length; i++) {
    const currentKey = keyframes[i];
    const lastKey = keyframes[Math.max(i - 1, 0)];
    const nextKey = keyframes[Math.min(i + 1, keyframes.length - 1)];

    res.push(newBezierKeyToOld(lastKey, currentKey, nextKey));
  }

  return res;
}

function newBezierKeyToOld (lastKey: Keyframe, currentKey: Keyframe, nextKey: Keyframe): spec.BezierKeyframeValue {
  const leftControl: Vector2Like = { x: 0, y: 0 };
  const rightControl: Vector2Like = { x: 0, y: 0 };
  const leftDeltaX = currentKey.inWeight * (currentKey.time - lastKey.time) / 3;

  leftControl.x = currentKey.time - leftDeltaX;
  leftControl.y = currentKey.value - leftDeltaX * currentKey.inSlope;

  const rightDeltaX = currentKey.outWeight * (nextKey.time - currentKey.time) / 3;

  rightControl.x = currentKey.time + rightDeltaX;
  rightControl.y = currentKey.value + rightDeltaX * currentKey.outSlope;

  if (currentKey.tangentMode === TangentMode.Constant) {
    // Constant 切线在规范侧映射为 HOLD 关键帧。
    return [
      spec.BezierKeyframeType.HOLD,
      [leftControl.x, leftControl.y, currentKey.time, currentKey.value],
      spec.BezierKeyframeType.EASE_IN,
    ];
  }

  return [
    spec.BezierKeyframeType.EASE,
    [leftControl.x, leftControl.y, currentKey.time, currentKey.value, rightControl.x, rightControl.y],
  ];
}

/**
 * 为区间 [leftKeyframe -> rightKeyframe] 计算控制点。
 *
 * 当 `lineToBezier=true` 时，会把 line/hold 段补齐为三次贝塞尔控制点，
 * 便于下游统一按 bezier 语义处理。
 */
export function getControlPoints (
  leftKeyframe: spec.BezierKeyframeValue,
  rightKeyframe: spec.BezierKeyframeValue,
  lineToBezier: boolean,
): ({ type: 'ease', p0: math.Vector2, p1: math.Vector2, p2: math.Vector2, p3: math.Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean } | { type: 'line', p0: math.Vector2, p1: math.Vector2, p2?: math.Vector2, p3?: math.Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean }) {
  const [, leftValue] = leftKeyframe;
  const leftHoldLine = keyframeInfo.isHoldOutKeyframe(leftKeyframe);
  const rightHoldLine = keyframeInfo.isHoldInKeyframe(rightKeyframe);

  const leftEase = !rightHoldLine && keyframeInfo.isRightSideEase(leftKeyframe);
  const rightEase = !leftHoldLine && keyframeInfo.isLeftSideEase(rightKeyframe);

  if (leftEase && !rightEase && !rightHoldLine) {
    const p0 = new math.Vector2(leftValue[leftValue.length - 4], leftValue[leftValue.length - 3]);
    const p1 = new math.Vector2(leftValue[leftValue.length - 2], leftValue[leftValue.length - 1]);
    const rightPoint = keyframeInfo.getPointInCurve(rightKeyframe);
    const p3 = new math.Vector2(rightPoint.x, rightPoint.y);
    const p2 = new math.Vector2(p3.x - (p3.x - p0.x) / 10, p3.y);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  if (!leftEase && rightEase && !leftHoldLine) {
    const [, rightValue] = rightKeyframe;
    const leftPoint = keyframeInfo.getPointInCurve(leftKeyframe);
    const p0 = new math.Vector2(leftPoint.x, leftPoint.y);
    const p2 = new math.Vector2(rightValue[0], rightValue[1]);
    const p3 = new math.Vector2(rightValue[2], rightValue[3]);
    const p1 = new math.Vector2(p0.x + (p3.x - p0.x) / 10, p0.y);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  if (leftEase && rightEase) {
    const [, rightValue] = rightKeyframe;
    const p0 = new math.Vector2(leftValue[leftValue.length - 4], leftValue[leftValue.length - 3]);
    const p1 = new math.Vector2(leftValue[leftValue.length - 2], leftValue[leftValue.length - 1]);
    const p2 = new math.Vector2(rightValue[0], rightValue[1]);
    const p3 = new math.Vector2(rightValue[2], rightValue[3]);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  const p0 = keyframeInfo.getPointInCurve(leftKeyframe);
  const p1 = keyframeInfo.getPointInCurve(rightKeyframe);

  if (leftHoldLine) {
    p1.y = p0.y;
  } else if (rightHoldLine) {
    p0.y = p1.y;
  }

  if (lineToBezier) {
    const p2 = new math.Vector2((p1.x - p0.x) / 3 + p0.x, (p1.y - p0.y) / 3 + p0.y);
    const p3 = new math.Vector2((p1.x - p0.x) / 3 * 2 + p0.x, (p1.y - p0.y) / 3 * 2 + p0.y);

    return { type: 'ease', p0, p1: p2, p2: p3, p3: p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
  }

  return { type: 'line', p0, p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
}

export const keyframeInfo = {
  pointIndexCache: {
    xIndex: 0,
    yIndex: 0,
  },

  /**
   * 获取关键帧在曲线上的锚点坐标。
   */
  getPointInCurve (keyframe: spec.BezierKeyframeValue): math.Vector2 {
    const [, data] = keyframe;
    const { xIndex, yIndex } = this.getPointIndexInCurve(keyframe, this.pointIndexCache);

    return new math.Vector2(data[xIndex], data[yIndex]);
  },

  /**
   * 解析关键帧原始 tuple 中锚点的 x/y 索引。
   */
  getPointIndexInCurve (keyframe: spec.BezierKeyframeValue, res?: {
    xIndex: number,
    yIndex: number,
  }): { xIndex: number, yIndex: number } {
    const [type, , markType] = keyframe;
    const index = type === spec.BezierKeyframeType.LINE ? 0
      : type === spec.BezierKeyframeType.EASE_OUT ? 0
        : type === spec.BezierKeyframeType.EASE_IN ? 2
          : type === spec.BezierKeyframeType.EASE ? 2
            : type === spec.BezierKeyframeType.HOLD ? (markType === spec.BezierKeyframeType.EASE_IN ? 2 : 0)
              : 0;

    if (res) {
      res.xIndex = index;
      res.yIndex = index + 1;

      return res;
    }

    return { xIndex: index, yIndex: index + 1 };
  },

  /**
   * 判断关键帧左侧是否应按 ease 段处理。
   */
  isLeftSideEase (keyframe: spec.BezierKeyframeValue): keyframe is spec.EaseInKeyframeValue | spec.EaseKeyframeValue | spec.EaseHoldOutKeyframeValue {
    const [keyframeType, , markType] = keyframe;

    if (keyframeType === spec.BezierKeyframeType.HOLD && this.isKeyframeTypeLeftSideEase(markType)) {
      return true;
    }

    return this.isKeyframeTypeLeftSideEase(keyframeType);
  },

  /**
   * 判断关键帧右侧是否应按 ease 段处理。
   */
  isRightSideEase (keyframe: spec.BezierKeyframeValue): keyframe is spec.EaseOutKeyframeValue | spec.EaseKeyframeValue | spec.EaseHoldInKeyframeValue {
    const [keyframeType, , markType] = keyframe;

    if (keyframeType === spec.BezierKeyframeType.HOLD && this.isKeyframeTypeRightSideEase(markType)) {
      return true;
    }

    return this.isKeyframeTypeRightSideEase(keyframeType);
  },

  isKeyframeTypeLeftSideEase (keyframeType: spec.BezierKeyframeType) {
    return [spec.BezierKeyframeType.EASE, spec.BezierKeyframeType.EASE_IN, spec.BezierKeyframeType.AUTO].includes(keyframeType);
  },

  isKeyframeTypeRightSideEase (keyframeType: spec.BezierKeyframeType) {
    return [spec.BezierKeyframeType.EASE, spec.BezierKeyframeType.EASE_OUT, spec.BezierKeyframeType.AUTO].includes(keyframeType);
  },

  /**
   * 是否为 HOLD 入关键帧（入段为 hold/line-out/ease-out）。
   */
  isHoldInKeyframe (keyframe: spec.BezierKeyframeValue) {
    const [keyframeType, , leftSubType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.HOLD, spec.BezierKeyframeType.LINE_OUT, spec.BezierKeyframeType.EASE_OUT].includes(leftSubType);
  },

  /**
   * 是否为 HOLD 出关键帧（出段为 hold/line/ease-in）。
   */
  isHoldOutKeyframe (keyframe: spec.BezierKeyframeValue) {
    const [keyframeType, , leftSubType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.HOLD, spec.BezierKeyframeType.LINE, spec.BezierKeyframeType.EASE_IN].includes(leftSubType);
  },
};
