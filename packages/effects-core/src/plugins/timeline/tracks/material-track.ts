import { RendererComponent } from '../../../components';
import { effectsClass, serialize } from '../../../decorators';
import { TrackAsset } from '../track';

@effectsClass('MaterialTrack')
export class MaterialTrack extends TrackAsset {

  @serialize()
  index: number;

  override updateAnimatedObject (boundObject: object): object {
    if (!(boundObject instanceof RendererComponent)) {
      throw new Error('MaterialTrack: expected a RendererComponent bound object.');
    }

    const materials = boundObject.materials;

    if (this.index >= materials.length) {
      throw new Error(`MaterialTrack: material index ${this.index} out of bounds (length=${materials.length}).`);
    }

    return materials[this.index];
  }
}
