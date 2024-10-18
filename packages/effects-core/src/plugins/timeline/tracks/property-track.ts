import type { EffectsObjectData } from '@galacean/effects-specification';
import { serialize } from '../../../decorators';
import { TrackAsset } from '../track';

export class PropertyTrack extends TrackAsset {

  protected propertyNames: string[] = [];

  @serialize()
  private path = '';

  override updateAnimatedObject () {
    const propertyNames = this.propertyNames;
    let target: Record<string, any> = this.parent.boundObject;

    for (let i = 0; i < propertyNames.length - 1; i++) {
      const property = target[propertyNames[i]];

      if (property === undefined) {
        console.error('The ' + propertyNames[i] + ' property of ' + target + ' was not found');
      }
      target = property;
    }

    this.boundObject = target;
  }

  override fromData (data: EffectsObjectData): void {
    super.fromData(data);
    const propertyNames = this.path.split('.');

    this.propertyNames = propertyNames;
  }
}