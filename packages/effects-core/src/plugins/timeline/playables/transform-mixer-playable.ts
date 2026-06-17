import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { isContributingTransform } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/**
 * TransformTrack 的 mixer。
 *
 * - 单 track（无 layerMixer）：在 evaluate 阶段直接把 contribution 写回 item.transform，
 *   时序与旧实现一致（processFrame 阶段即可见，供嵌套合成 / 父子继承读取）。
 * - 多 track（有 layerMixer）：把 contribution 提交给 layerMixer，由其收齐后统一合成写回。
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
        // 多 track：提交贡献（delta），延迟到 layerMixer.flush 统一合成
        layerMixer.addContribution(item, playable.getContribution(layerMixer.getBasePosition()), weight);
      } else {
        // 单 track：当场直写，与旧实现时序一致
        playable.applyContribution(item);
      }
    }
  }
}
