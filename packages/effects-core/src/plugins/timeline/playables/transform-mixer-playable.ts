import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { isContributingTransform } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/**
 * TransformTrack 的 mixer。
 * - 单 track（无 layerMixer）：evaluate 阶段直写 item.transform。
 * - 多 track（有 layerMixer）：提交 contribution，由 layerMixer 合成。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    const layerMixer = context.transformLayerMixerMap?.get(item.getInstanceId());

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!weight || weight <= 0) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!isContributingTransform(playable)) {
        continue;
      }

      if (layerMixer) {
        // 多 track：提交 delta 贡献，由 layerMixer.flush 合成
        layerMixer.addContribution(item, playable.getContribution(layerMixer.getBasePosition()), weight);
      } else {
        // 单 track：当场直写
        playable.applyContribution(item);
      }
    }
  }
}
