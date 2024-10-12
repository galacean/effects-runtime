import * as spec from '@galacean/effects-specification';
import { EffectsObject } from './effects-object';
import { effectsClass, serialize } from './decorators';

@effectsClass(spec.DataType.BinaryAsset)
export class BinaryAsset extends EffectsObject {
  @serialize()
  buffer: ArrayBuffer;

  override fromData (data: spec.EffectsObjectData): void {

  }
}
