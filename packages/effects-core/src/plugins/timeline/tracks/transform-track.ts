import * as spec from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../../decorators';
import type { Playable } from '../playable';
import type { TrackMixerPlayable } from '../playables';
import { TransformMixerPlayable, TransformPlayable } from '../playables';
import type { TrackBlendMode } from '../playables/transform-playable';
import type { TimelineClip } from '../track';
import { TrackAsset } from '../track';

@effectsClass(spec.DataType.TransformTrack)
export class TransformTrack extends TrackAsset {
  @serialize()
  blendMode: TrackBlendMode = 'override';

  override createTrackMixer (): TrackMixerPlayable {
    const mixer = new TransformMixerPlayable();

    mixer.trackBlendMode = this.blendMode;

    return mixer;
  }

  protected override createClipPlayable (clip: TimelineClip): Playable {
    const playable = super.createClipPlayable(clip);

    if (playable instanceof TransformPlayable) {
      playable.blendMode = this.blendMode;
    }

    return playable;
  }
}
