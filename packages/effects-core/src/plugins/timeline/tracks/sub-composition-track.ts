import * as spec from '@galacean/effects-specification';
import { VFXItem } from '../../../vfx-item';
import { CompositionComponent } from '../../../comp-vfx-item';
import { TrackAsset } from '../track';
import { effectsClass } from '../../../decorators';
import type { PlayableGraph, Playable } from '../../cal/playable-graph';
import { SubCompositionMixerPlayable } from '../playables';

@effectsClass(spec.DataType.SubCompositionTrack)
export class SubCompositionTrack extends TrackAsset {

  override resolveBinding () {
    if (!this.parent || !(this.parent.boundObject instanceof VFXItem)) {
      throw new Error('SubCompositionTrack needs to be set under the VFXItem track.');
    }
    this.boundObject = this.parent.boundObject.getComponent(CompositionComponent);
  }

  override createTrackMixer (graph: PlayableGraph): Playable {
    return new SubCompositionMixerPlayable(graph);
  }
}
