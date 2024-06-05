import { effectsClass } from 'packages/effects-core/src/decorators';
import { TrackAsset } from '../track';
import { VFXItem } from 'packages/effects-core/src/vfx-item';
import { CompositionComponent } from 'packages/effects-core/src/comp-vfx-item';

@effectsClass('SubCompositionTrack')
export class SubCompositionTrack extends TrackAsset {

  override resolveBinding (parentBinding: object): object {
    if (!(parentBinding instanceof VFXItem)) {
      throw new Error('SubCompositionTrack needs to be set under the VFXItem track');
    }

    return parentBinding.getComponent(CompositionComponent);
  }
}