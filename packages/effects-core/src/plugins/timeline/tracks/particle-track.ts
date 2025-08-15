import type { TrackMixerPlayable } from '../playables';
import { ParticleMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

export class ParticleTrack extends TrackAsset {

  override createTrackMixer (): TrackMixerPlayable {
    return new ParticleMixerPlayable();
  }
}
