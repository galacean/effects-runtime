import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { TransformClipMixer } from '../transform-clip-mixer';
import { TransformPlayable } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/**
 * TransformTrack 的 mixer。
 * 将本 track 下当前激活的 Transform clip 采样为 contribution，并做 additive 合成。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private readonly clipMixer = new TransformClipMixer();

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    let hasActiveClip = false;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!weight || weight <= 0) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!(playable instanceof TransformPlayable)) {
        continue;
      }

      if (!hasActiveClip) {
        this.clipMixer.captureBasePose(item);
        this.clipMixer.resetFrame();
        hasActiveClip = true;
      }

      this.clipMixer.addContribution(
        item,
        playable.getContribution(this.clipMixer.getBasePosition()),
        weight,
      );
    }

    if (hasActiveClip) {
      this.clipMixer.flush(item);
    }
  }
}
