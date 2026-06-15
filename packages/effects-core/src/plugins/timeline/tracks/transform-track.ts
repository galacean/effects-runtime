import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { TrackMixerPlayable } from '../playables';
import { TransformMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

@effectsClass(spec.DataType.TransformTrack)
export class TransformTrack extends TrackAsset {

  override createTrackMixer (): TrackMixerPlayable {
    return new TransformMixerPlayable();
  }
}
