import { effectsClass } from '../../../decorators';
import type { TrackMixerPlayable } from '../playables';
import { ObjectReferencePropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

/** Animates an object reference property on the bound object. */
@effectsClass('ObjectReferencePropertyTrack')
export class ObjectReferencePropertyTrack extends PropertyTrack {
  override createTrackMixer (): TrackMixerPlayable {
    const mixer = new ObjectReferencePropertyMixerPlayable();

    mixer.propertyPath = this.path;

    return mixer;
  }
}
