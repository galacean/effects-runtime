import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { Vector4PropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.Vector4PropertyTrack)
export class Vector4PropertyTrack extends PropertyTrack {
  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new Vector4PropertyMixerPlayable(graph);

    const propertyNames = this.propertyNames;

    if (propertyNames.length > 0) {
      const propertyName = propertyNames[propertyNames.length - 1];

      mixer.propertyName = propertyName;
    }

    return mixer;
  }
}