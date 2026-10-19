import type { FrameContext } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';
import type { SpriteComponent } from '../../sprite/sprite-item';
import type { Sprite } from '../../sprite/sprite';
import { TrackMixerPlayable } from './track-mixer-playable';
import type { PropertyClipPlayable } from './property-clip-playable';

/**
 * Sprite 属性 K 帧 mixer。对象引用不混合：取首个激活 clip 的阶梯采样值，
 * 赋值 boundObject.sprite 触发 setter（同步纹理 + 重建 UV）。
 * 允许初始 sprite 为空，不使用数值属性的混合规则。
 */
export class SpritePropertyMixerPlayable extends TrackMixerPlayable {
  override evaluate (segmentId: number, spriteComponent: SpriteComponent | undefined, context: FrameContext, cache: CacheDataManager): void {
    if (!spriteComponent) {
      return;
    }
    // 对象引用不混合：取首个激活 clip 的采样值
    for (const clipData of this.getSegment(segmentId).clips) {
      const index = clipData.playableIndex;

      if (this.getClipWeight(index) > 0) {
        const clip = this.clipPlayables[index] as PropertyClipPlayable<Sprite>;

        if (clip.value) {
          spriteComponent.sprite = clip.value;
        }

        break;
      }
    }
  }
}
