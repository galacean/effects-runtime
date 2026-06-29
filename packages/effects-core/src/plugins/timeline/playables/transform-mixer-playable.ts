import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { TransformClipMixer } from '../transform-clip-mixer';
import { TransformPlayable } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/**
 * TransformTrack 的 mixer。
 * 收集当前激活的 Transform clip contribution，并委托 TransformClipMixer 合成当前帧输出。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private readonly clipMixer = new TransformClipMixer();

  override dispose (): void {
    this.clipMixer.dispose();
    super.dispose();
  }

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    let hasActiveClip = false;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      // RuntimeClip 会把已结束且 destroy 的 clip 权重置 0，这类 clip 不参与当前帧合成。
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
