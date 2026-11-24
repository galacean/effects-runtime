import type * as spec from '@galacean/effects-specification';
import { TrackAsset } from '../track';

export abstract class PropertyTrack extends TrackAsset {

  protected path = '';

  override fromData (data: spec.PropertyTrackData): void {
    super.fromData(data);
    if (data.path !== undefined) {
      this.path = data.path;
    }
  }
}
