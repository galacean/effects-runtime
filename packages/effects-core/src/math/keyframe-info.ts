import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';

type KeyframeValue = spec.FixedNumberExpression | spec.FixedVec3Expression;

export const keyframeInfo = {
  /**
   * 根据不同关键帧类型，获取位于曲线上的点
   */
  getPointInCurve (keyframe: spec.BezierKeyframeValue): Vector2 {
    const [_, data] = keyframe;
    const { xIndex, yIndex } = this.getPointIndexInCurve(keyframe);
    const time = data[xIndex];
    const value = data[yIndex];

    return new Vector2(time, value);
  },

  /**
   * 根据不同关键帧类型，获取位于曲线外控制点
   */
  getPointOutCurve (keyframe: spec.BezierKeyframeValue, side: 'left' | 'right'): {
    x: number,
    y: number,
  } {
    const [_, data] = keyframe;
    const { xIndex, yIndex } = this.getPointIndexOutCurve(keyframe, side);

    return xIndex >= 0 ? new Vector2(
      data[xIndex],
      data[yIndex],
    ) : new Vector2(Infinity, Infinity);
  },

  /**
   * 根据不同关键帧类型，获取位于曲线上的点的索引
   */
  getPointIndexInCurve (keyframe: spec.BezierKeyframeValue): {
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

    return { xIndex: index, yIndex: index + 1 };
  },

  /**
   * 根据不同关键帧类型，获取位于曲线外控制点的索引
   */
  getPointIndexOutCurve (keyframe: spec.BezierKeyframeValue, side: 'left' | 'right') {
    const [type, , markType] = keyframe;
    // 不同类型，存放的时间不同
    const index = type === spec.BezierKeyframeType.LINE ? -1
      : type === spec.BezierKeyframeType.EASE_OUT ? (side === 'right' ? 2 : -1)
        : type === spec.BezierKeyframeType.EASE_IN ? (side === 'left' ? 0 : -1)
          : type === spec.BezierKeyframeType.EASE ? (side === 'left' ? 0 : 4)
            : type === spec.BezierKeyframeType.HOLD ? (
              markType === spec.BezierKeyframeType.EASE_IN && side === 'left' ? 0
                : markType === spec.BezierKeyframeType.EASE_OUT && side === 'right' ? 2 : -1)
              : -1;

    return { xIndex: index, yIndex: index >= 0 ? index + 1 : -1 };
  },

  /**
   * 根据不同关键帧类型，获取曲线上关键帧时间
   */
  getKeyframeTime (keyframe: spec.BezierKeyframeValue): number {
    return this.getPointInCurve(keyframe).x;
  },

  /**
   * 根据不同关键帧类型，获取曲线上关键帧的值
   */
  getKeyframeValue (keyframe: spec.BezierKeyframeValue): number {
    return this.getPointInCurve(keyframe).y;
  },

  /**
   * 根据不同关键帧类型，获取曲线外控制点的时间
   */
  getControlTime (keyframe: spec.BezierKeyframeValue, side: 'left' | 'right'): number {
    const pointIndex = this.getPointOutCurve(keyframe, side);

    return pointIndex.x;
  },

  /**
   * 根据不同关键帧类型，获取曲线外控制点的值
   */
  getControlValue (keyframe: spec.BezierKeyframeValue, side: 'left' | 'right'): number {
    const pointIndex = this.getPointOutCurve(keyframe, side);

    return pointIndex.y;
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

  isSideEase (keyframe: spec.BezierKeyframeValue, side: 'left' | 'right') {
    return side === 'left' ? this.isLeftSideEase(keyframe) : this.isRightSideEase(keyframe);
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
   * 是否为缓动类型的定格关键帧
   */
  isEaseHoldKeyframe (keyframe: spec.BezierKeyframeValue): keyframe is spec.EaseHoldInKeyframeValue | spec.EaseHoldOutKeyframeValue {
    const [keyframeType, ,markType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.EASE_IN, spec.BezierKeyframeType.EASE_OUT].includes(markType);
  },

  /**
   * 是否为线性类型的定格关键帧
   */
  isLineHoldKeyframe (keyframe: spec.BezierKeyframeValue): keyframe is spec.LineHoldInKeyframeValue | spec.LineHoldOutKeyframeValue {
    const [keyframeType, ,markType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.HOLD && [spec.BezierKeyframeType.LINE, spec.BezierKeyframeType.LINE_OUT].includes(markType);
  },

  /**
   * 是否为定格关键帧
   */
  isHoldKeyframe (keyframe: spec.BezierKeyframeValue) {
    return keyframe[0] === spec.BezierKeyframeType.HOLD;
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

  /**
   * 是否为自动关键帧
   */
  isAutoKeyframe (keyframe: spec.BezierKeyframeValue) {
    const [keyframeType, ,markType] = keyframe;

    return keyframeType === spec.BezierKeyframeType.EASE && markType === spec.BezierKeyframeType.AUTO;
  },

  /**
   * 是否为自动关键帧（考虑首尾帧的情况）
   */
  isAutoKeyframeFull (keyframes: spec.BezierKeyframeValue[], keyframeIndex: number) {
    const keyframe = keyframes[keyframeIndex];

    if (this.isAutoKeyframe(keyframe)) {
      return true;
    }
    const [keyframeType] = keyframe;

    if (keyframeIndex === 0 && keyframeType === spec.BezierKeyframeType.EASE_OUT) {
      return true;
    }
    if (keyframeIndex === keyframes.length - 1 && keyframeType === spec.BezierKeyframeType.EASE_IN) {
      return true;
    }

    return false;
  },

  /**
   * 是否为线性路径
   */
  isLinearKeyframePath (keyframeValue?: KeyframeValue) {
    if (!keyframeValue) {
      return false;
    }
    const [valueType, valueData] = keyframeValue;

    if (valueType === spec.ValueType.BEZIER_CURVE_PATH) {
      const [easing] = valueData;

      return easing.every(keyframe => {
        const [type, ,markType] = keyframe;

        return type === spec.BezierKeyframeType.LINE && markType === spec.BezierKeyframeType.LINE;
      });
    }

    return false;
  },

  /**
   * 获取关键帧个数
   */
  getKeyframeCount (value?: KeyframeValue) {
    if (!value) {
      return 0;
    }
    const [type, data] = value;

    return type === spec.ValueType.BEZIER_CURVE ? data.length
      : type === spec.ValueType.BEZIER_CURVE_PATH ? data[1].length
        : 0;
  },

};
