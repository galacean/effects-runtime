import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { ReferenceCurve } from '../../../math';
import type { Sprite } from '../../sprite/sprite';

/** Sprite 引用关键帧：[归一化时间 0-1, Sprite 引用] */
export type SpriteKeyframe = [time: number, sprite: spec.DataPath];

export interface SpritePropertyAssetData extends spec.EffectsObjectData {
  /** 关键帧列表（按 time 升序，{id} 在 fromData 解析为 Sprite 实例） */
  keyframes: SpriteKeyframe[],
}

/**
 * Sprite 属性 K 帧 PlayableAsset：持 Sprite 引用关键帧，createPlayable 复用
 * PropertyClipPlayable<Sprite> + SpriteReferenceCurve（阶梯采样，不插值）。
 *
 * 不使用 @serialize：keyframes 含 {id} 引用，反序列化集中在 fromData 用
 * engine.findObject 解析（避免序列化/反序列化双路径的引用覆盖陷阱）。
 */
@effectsClass('SpritePropertyPlayableAsset')
export class SpritePropertyPlayableAsset extends PlayableAsset {
  /** 解析后的关键帧（sprite 为 Sprite 实例） */
  keyframes: [time: number, sprite: Sprite][] = [];

  override fromData (data: SpritePropertyAssetData): void {
    super.fromData(data);
    const raw = data.keyframes ?? [];

    this.keyframes = [];
    for (let i = 0; i < raw.length; i++) {
      const [t, ref] = raw[i];

      this.keyframes.push([t, this.engine.findObject<Sprite>(ref)]);
    }
  }

  override createPlayable (): Playable {
    const clip = new PropertyClipPlayable<Sprite>();

    clip.curve = new ReferenceCurve<Sprite>(this.keyframes);
    clip.value = clip.curve.getValue(0);

    return clip;
  }
}
