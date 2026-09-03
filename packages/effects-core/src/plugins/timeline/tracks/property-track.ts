import type { TrackAssetData } from '@galacean/effects-specification';
import { TrackAsset } from '../track';

interface PropertyTrackData extends TrackAssetData {
  path?: string,
}

export abstract class PropertyTrack extends TrackAsset {

  protected propertyNames: string[] = [];

  protected path = '';

  override fromData (data: PropertyTrackData): void {
    super.fromData(data);
    if (data.path !== undefined) {
      this.path = data.path;
    }
    const propertyNames = this.path.split('.');

    this.propertyNames = propertyNames;
  }
}
