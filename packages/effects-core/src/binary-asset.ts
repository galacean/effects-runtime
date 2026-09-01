import * as spec from '@galacean/effects-specification';
import { EffectsObject } from './effects-object';
import { effectsClass } from './decorators';

interface BinaryAssetData extends spec.EffectsObjectData {
  buffer?: ArrayBuffer,
}

@effectsClass(spec.DataType.BinaryAsset)
export class BinaryAsset extends EffectsObject {
  buffer: ArrayBuffer;

  override fromData (data: BinaryAssetData): void {
    super.fromData(data);
    if (data.buffer !== undefined) {
      this.buffer = data.buffer;
    }
  }
}
