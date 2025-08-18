import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { FloatPropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.FloatPropertyTrack)
export class FloatPropertyTrack extends PropertyTrack {

  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new FloatPropertyMixerPlayable(graph);

    mixer.propertyPath = this.path;

    return mixer;
  }

  override updateAnimatedObject () {
    this.boundObject = this.parent.boundObject;
  }
}
