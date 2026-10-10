import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { TransformClipMixer } from '../transform-clip-mixer';
import { TransformPlayable } from './transform-playable';
import type { ItemBasicTransform } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/**
 * TransformTrack 的 mixer。
 * 收集当前激活的 Transform clip contribution，并委托 TransformClipMixer 合成当前帧输出。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private readonly clipMixer = new TransformClipMixer();

  override captureRestoreState (context: FrameContext): number {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return -1;
    }

    return this.trackInstance.composition.addRestoreData({
      position: item.transform.position.clone(),
      rotation: item.transform.getRotation().clone(),
      scale: item.transform.scale.clone(),
    });
  }

  override restoreState (context: FrameContext, pose: ItemBasicTransform): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    item.transform.setPosition(pose.position.x, pose.position.y, pose.position.z);
    item.transform.setRotation(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    item.transform.setScale(pose.scale.x, pose.scale.y, pose.scale.z);
  }

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }
    const track = this.trackInstance;

    if (track.restoreStateIndex === -1) {
      track.restoreStateIndex = this.captureRestoreState(context);
    }
    const basePose = track.composition.getRestoreData<ItemBasicTransform>(track.restoreStateIndex);

    this.clipMixer.resetFrame(basePose);

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

      this.clipMixer.addContribution(
        playable.getContribution(basePose.position),
        weight,
      );
    }

    this.clipMixer.flush(item);
  }
}
