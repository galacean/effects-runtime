import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { ColorPropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.ColorPropertyTrack)
export class ColorPropertyTrack extends PropertyTrack {
  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new ColorPropertyMixerPlayable(graph);

    const propertyNames = this.propertyNames;

    if (propertyNames.length > 0) {
      const propertyName = propertyNames[propertyNames.length - 1];

      mixer.propertyName = propertyName;
    }

    return mixer;
  }
}