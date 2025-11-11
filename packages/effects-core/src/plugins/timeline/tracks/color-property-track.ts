import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { TrackMixerPlayable } from '../playables';
import { ColorPropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.ColorPropertyTrack)
export class ColorPropertyTrack extends PropertyTrack {
  override createTrackMixer (): TrackMixerPlayable {
    const mixer = new ColorPropertyMixerPlayable();

    mixer.propertyPath = this.path;

    return mixer;
  }
}