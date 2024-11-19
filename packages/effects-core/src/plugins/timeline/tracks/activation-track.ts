import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { ActivationMixerPlayable } from '../playables/activation-mixer-playable';
import { TrackAsset } from '../track';

@effectsClass(spec.DataType.ActivationTrack)
export class ActivationTrack extends TrackAsset {
  override createTrackMixer (graph: PlayableGraph): Playable {
    return new ActivationMixerPlayable(graph);
  }
}
