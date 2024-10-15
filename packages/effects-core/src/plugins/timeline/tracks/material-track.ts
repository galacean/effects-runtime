import { RendererComponent } from 'packages/effects-core/src/components';
import { effectsClass, serialize } from '../../../decorators';
import { TrackAsset } from '../track';

@effectsClass('MaterialTrack')
export class MaterialTrack extends TrackAsset {

  @serialize()
  index: number;

  override resolveBinding () {
    if (!(this.parent.boundObject instanceof RendererComponent)) {
      return;
    }
    this.parent.boundObject;
    this.boundObject = this.parent.boundObject.materials[this.index];
  }
}
