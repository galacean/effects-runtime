import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { TrackMixerPlayable } from '../playables';
import { FloatPropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.FloatPropertyTrack)
export class FloatPropertyTrack extends PropertyTrack {

  override createTrackMixer (): TrackMixerPlayable {
    const mixer = new FloatPropertyMixerPlayable();

    mixer.propertyPath = this.path;

    return mixer;
  }
}
