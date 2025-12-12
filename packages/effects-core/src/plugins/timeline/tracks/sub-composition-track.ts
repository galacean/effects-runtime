import * as spec from '@galacean/effects-specification';
import { CompositionComponent } from '../../../components/composition-component';
import { effectsClass } from '../../../decorators';
import { VFXItem } from '../../../vfx-item';
import type { TrackMixerPlayable } from '../playables';
import { SubCompositionMixerPlayable } from '../playables';
import { TrackAsset } from '../track';

@effectsClass(spec.DataType.SubCompositionTrack)
export class SubCompositionTrack extends TrackAsset {

  override updateAnimatedObject (boundObject: object): object {
    if (!(boundObject instanceof VFXItem)) {
      throw new Error('SubCompositionTrack needs to be set under the VFXItem track.');
    }

    return boundObject.getComponent(CompositionComponent);
  }

  override createTrackMixer (): TrackMixerPlayable {
    return new SubCompositionMixerPlayable();
  }
}
