import type { FrameContext } from '../playable';
import type { SpriteComponent } from '../../sprite/sprite-item';
import type { Sprite } from '../../sprite/sprite';
import { TrackMixerPlayable } from './track-mixer-playable';
import type { PropertyClipPlayable } from './property-clip-playable';

/**
 * Sprite 属性 K 帧 mixer。对象引用不混合：取首个激活 clip 的阶梯采样值，
 * 赋值 boundObject.sprite 触发 setter（同步纹理 + 重建 UV）。
 * 不继承 PropertyMixerPlayable（其 evaluate 开头"读当前值为 null 则 return"
 * 会阻断无初始 sprite 组件的 K 帧）。
 */
export class SpritePropertyMixerPlayable extends TrackMixerPlayable {
  override evaluate (spriteComponent: SpriteComponent, context: FrameContext): void {
    // 对象引用不混合：取首个激活 clip 的采样值
    for (const clipData of this.activeClips) {
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
