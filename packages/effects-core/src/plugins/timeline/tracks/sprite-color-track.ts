import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph } from '../../cal/playable-graph';
import type { TrackMixerPlayable } from '../playables';
import { SpriteColorMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

@effectsClass(spec.DataType.SpriteColorTrack)
export class SpriteColorTrack extends TrackAsset {
  override createTrackMixer (graph: PlayableGraph): TrackMixerPlayable {
    return new SpriteColorMixerPlayable(graph);
  }
}
