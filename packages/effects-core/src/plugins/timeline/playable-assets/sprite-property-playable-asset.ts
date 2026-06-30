import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter, REFERENCE_CURVE } from '../../../math';
import type { ReferenceCurveData, ValueGetter } from '../../../math';
import type { Sprite } from '../../sprite/sprite';

/**
 * 对象引用曲线序列化值：[REFERENCE_CURVE, [time, DataPath][]]，value 为 {id} 引用。
 * 序列化形态，无泛型。
 * TODO: update to spec.
 */
export type ReferenceCurveValue = [number, [number, spec.DataPath][]];

export interface SpritePropertyAssetData extends spec.EffectsObjectData {
  curveData: ReferenceCurveValue,
}

/**
 * Sprite 属性 K 帧 PlayableAsset：curveData 为对象引用阶梯曲线，
 * createPlayable 复用 PropertyClipPlayable<Sprite> + ReferenceCurve（阶梯采样，不插值）。
 */
@effectsClass('SpritePropertyPlayableAsset')
export class SpritePropertyPlayableAsset extends PlayableAsset {
  curveData: [number, ReferenceCurveData<Sprite>] = [REFERENCE_CURVE, []];

  override fromData (data: SpritePropertyAssetData): void {
    super.fromData(data);
    const items = data.curveData[1];
    // 把 DataPath 解析为 Sprite 实例
    const referenceCurveData: [number, Sprite][] = [];

    for (let i = 0; i < items.length; i++) {
      const [t, ref] = items[i];

      referenceCurveData.push([t, this.engine.findObject<Sprite>(ref)]);
    }
    this.curveData[1] = referenceCurveData;
  }

  override createPlayable (): Playable {
    const clip = new PropertyClipPlayable<Sprite>();

    clip.curve = createValueGetter(this.curveData) as ValueGetter<Sprite>;
    clip.value = clip.curve.getValue(0);

    return clip;
  }
}
