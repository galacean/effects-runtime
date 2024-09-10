import type { EffectsObjectData } from '@galacean/effects-specification';
import { EffectsObject } from '../../effects-object';
import { effectsClass, serialize } from '../../decorators';

@effectsClass('BinaryAsset')
export class BinaryAsset extends EffectsObject {
  @serialize()
  buffer: ArrayBuffer;

  override fromData (data: EffectsObjectData): void {

  }
}
