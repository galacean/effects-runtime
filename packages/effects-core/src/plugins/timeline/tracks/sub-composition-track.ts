import { effectsClass } from 'packages/effects-core/src/decorators';
import { TrackAsset } from '../track';
import type { VFXItem } from 'packages/effects-core/src/vfx-item';
import { CompositionComponent } from 'packages/effects-core/src/comp-vfx-item';

@effectsClass('SubCompositionTrack')
export class SubCompositionTrack extends TrackAsset {

  override onBindingInitialize (parentBinding: object): void {
    this.binding = (parentBinding as VFXItem).getComponent(CompositionComponent);
  }
}