import type * as spec from '@galacean/effects-specification';
import { RendererComponent } from '../../../components';
import { effectsClass } from '../../../decorators';
import { TrackAsset } from '../track';

interface MaterialTrackData extends spec.TrackAssetData {
  index?: number,
}

@effectsClass('MaterialTrack')
export class MaterialTrack extends TrackAsset {

  index: number;

  override fromData (data: MaterialTrackData): void {
    super.fromData(data);
    if (data.index !== undefined) {
      this.index = data.index;
    }
  }

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
