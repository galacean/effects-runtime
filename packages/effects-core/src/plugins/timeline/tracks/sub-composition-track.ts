import { VFXItem } from '../../../vfx-item';
import { CompositionComponent } from '../../../comp-vfx-item';
import { TrackAsset } from '../track';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { SubCompositionMixerPlayable } from '../playables/sub-composition-mixer-playable';

@effectsClass('SubCompositionTrack')
export class SubCompositionTrack extends TrackAsset {

  override resolveBinding (parentBinding: object): object {
    if (!(parentBinding instanceof VFXItem)) {
      throw new Error('SubCompositionTrack needs to be set under the VFXItem track.');
    }

    return parentBinding.getComponent(CompositionComponent);
  }

  override createTrackMixer (graph: PlayableGraph): Playable {
    return new SubCompositionMixerPlayable(graph);
  }
}
