import type { EffectsObject } from '../../effects-object';
import { ValueGetter } from './value-getter';

/**
 * 对象引用关键帧：[归一化时间 0-1, 对象引用]。value 为 EffectsObject，通用对象引用。
 */
export type ReferenceKeyframe<T extends EffectsObject> = [time: number, value: T];

/**
 * 通用对象引用阶梯曲线（不插值）。对象引用不可插值，
 * 按时间阶梯采样取 time ≤ t 的最近关键帧。
 *
 * 继承 ValueGetter 以复用 PropertyClipPlayable<T>；数值相关方法
 * （toUniform/toData/getIntegrate*）保留基类 NOT_IMPLEMENT——对象引用 curve
 * 不走 shader 通路。典型用例：T = Sprite（sprite 属性 K 帧切图）。
 */
export class ReferenceCurve<T extends EffectsObject> extends ValueGetter<T> {
  private keyframes: ReferenceKeyframe<T>[];

  override onCreate (props: ReferenceKeyframe<T>[]) {
    this.keyframes = props;
  }

  override getValue (time?: number): T {
    const keys = this.keyframes;

    if (keys.length === 0) {
      return undefined as unknown as T;
    }
    // 阶梯采样：取 time ≤ t 的最大关键帧；t < 首帧取首帧。无插值。
    let result = keys[0][1];

    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] <= (time ?? 0)) {
        result = keys[i][1];
      } else {
        break;
      }
    }

    return result;
  }
}
