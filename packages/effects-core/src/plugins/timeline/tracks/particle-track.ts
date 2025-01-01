import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { ParticleMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

export class ParticleTrack extends TrackAsset {

  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    return new ParticleMixerPlayable(graph);
  }
}
