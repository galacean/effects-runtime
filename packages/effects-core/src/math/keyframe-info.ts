import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import * as spec from '@galacean/effects-specification';

export const keyframeInfo = {
  pointIndexCache : {
    xIndex: 0,
    yIndex: 0,
  },
  /**
   * 根据不同关键帧类型，获取位于曲线上的点
   */
  getPointInCurve (keyframe: spec.BezierKeyframeValue): Vector2 {
    const [_, data] = keyframe;
    const { xIndex, yIndex } = this.getPointIndexInCurve(keyframe, this.pointIndexCache);
    const time = data[xIndex];
    const value = data[yIndex];

    return new Vector2(time, value);
  },

  /**
   * 根据不同关键帧类型，获取位于曲线上的点的索引
   */
  getPointIndexInCurve (keyframe: spec.BezierKeyframeValue, res?: {
    xIndex: number,
    yIndex: number,
  }): {
      xIndex: number,
      yIndex: number,
    } {
    const [type, , markType] = keyframe;
    // 不同类型，存放的时间不同
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
    } else {
      return { xIndex: index, yIndex: index + 1 };
    }
  },

  /**
   * 关键帧左侧是否为缓动类型（否则为线段）
   */
  isLeftSideEase (keyframe: spec.BezierKeyframeValue): keyframe is spec.EaseInKeyframeValue | spec.EaseKeyframeValue | spec.EaseHoldOutKeyframeValue {
    const [keyframeType, _, markType] = keyframe;

    // 定格关键帧的左侧类型，需要借助markType判断
    if (keyframeType === spec.BezierKeyframeType.HOLD && this.isKeyframeTypeLeftSideEase(markType)) {
      return true;
    }

    return this.isKeyframeTypeLeftSideEase(keyframeType);
  },

  /**
   * 关键帧右侧是否为缓动类型（否则为线段）
   */
  isRightSideEase (keyframe: spec.BezierKeyframeValue): keyframe is spec.EaseOutKeyframeValue | spec.EaseKeyframeValue | spec.EaseHoldInKeyframeValue {
    const [keyframeType, _, markType] = keyframe;

    // 定格关键帧的右侧类型，需要借助markType判断
    if (keyframeType === spec.BezierKeyframeType.HOLD && this.isKeyframeTypeRightSideEase(markType)) {
      return true;
    }

    return this.isKeyframeTypeRightSideEase(keyframeType);
  },

  /**
   * 关键帧左侧是否为缓动类型（否则为线段）
   */
  isKeyframeTypeLeftSideEase (keyframeType: spec.BezierKeyframeType) {
    return [spec.BezierKeyframeType.EASE, spec.BezierKeyframeType.EASE_IN, spec.BezierKeyframeType.AUTO].includes(keyframeType);
  },

  /**
   * 关键帧右侧是否为缓动类型（否则为线段）
   */
  isKeyframeTypeRightSideEase (keyframeType: spec.BezierKeyframeType) {
    return [spec.BezierKeyframeType.EASE, spec.BezierKeyframeType.EASE_OUT, spec.BezierKeyframeType.AUTO].includes(keyframeType);
  },

  /**
   * 是否为定格进关键帧
   */
  isHoldInKeyframe (keyframe: spec.BezierKeyframeValue) {
    const [keyframeType, _, leftSubType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.HOLD, spec.BezierKeyframeType.LINE_OUT, spec.BezierKeyframeType.EASE_OUT].includes(leftSubType);
  },

  /**
   * 是否为定格出关键帧
   */
  isHoldOutKeyframe (keyframe: spec.BezierKeyframeValue) {
    const [keyframeType, _, leftSubType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.HOLD, spec.BezierKeyframeType.LINE, spec.BezierKeyframeType.EASE_IN].includes(leftSubType);
  },
};
