import * as spec from '@galacean/effects-specification';
import { CompositionComponent, UpdateModes } from '../../../components';
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

    const composition = boundObject.getComponent(CompositionComponent);

    // The parent clip owns this component's time as soon as it is bound.
    composition.updateMode = UpdateModes.Manual;

    return composition;
  }

  override createTrackMixer (): TrackMixerPlayable {
    return new SubCompositionMixerPlayable();
  }
}
