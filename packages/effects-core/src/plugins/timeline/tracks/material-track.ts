import type { RendererComponent } from '../../../components';
import { effectsClass, serialize } from '../../../decorators';
import { TrackAsset } from '../track';

@effectsClass('MaterialTrack')
export class MaterialTrack extends TrackAsset {

  @serialize()
  index: number;

  override updateAnimatedObject (boundObject: object): object {
    return (boundObject as RendererComponent).materials[this.index];
  }
}
