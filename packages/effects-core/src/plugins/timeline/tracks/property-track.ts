import type { EffectsObjectData } from '@galacean/effects-specification';
import { serialize } from '../../../decorators';
import { TrackAsset } from '../track';

export abstract class PropertyTrack extends TrackAsset {

  protected propertyNames: string[] = [];

  @serialize()
  protected path = '';

  override fromData (data: EffectsObjectData): void {
    super.fromData(data);
    const propertyNames = this.path.split('.');

    this.propertyNames = propertyNames;
  }
}