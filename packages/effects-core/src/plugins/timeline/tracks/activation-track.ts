import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import { ActivationMixerPlayable } from '../playables/activation-mixer-playable';
import { TrackAsset } from '../track';
import type { TrackMixerPlayable } from '../playables/track-mixer-playable';

@effectsClass(spec.DataType.ActivationTrack)
export class ActivationTrack extends TrackAsset {
  override createTrackMixer (): TrackMixerPlayable {
    return new ActivationMixerPlayable();
  }
}
