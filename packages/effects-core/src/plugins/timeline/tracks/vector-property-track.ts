import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { Vector2PropertyMixerPlayable, Vector4PropertyMixerPlayable } from '../playables';
import { PropertyTrack } from './property-track';

@effectsClass(spec.DataType.Vector4PropertyTrack)
export class Vector4PropertyTrack extends PropertyTrack {
  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new Vector4PropertyMixerPlayable(graph);

    mixer.propertyPath = this.path;

    return mixer;
  }
}

@effectsClass(spec.DataType.Vector2PropertyTrack)
export class Vector2PropertyTrack extends PropertyTrack {
  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    const mixer = new Vector2PropertyMixerPlayable(graph);

    mixer.propertyPath = this.path;

    return mixer;
  }
}