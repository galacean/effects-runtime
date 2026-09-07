import * as spec from '@galacean/effects-specification';
import { Asset } from './asset';
import { effectsClass } from './decorators';

interface BinaryAssetData extends spec.EffectsObjectData {
  buffer?: ArrayBuffer,
}

@effectsClass(spec.DataType.BinaryAsset)
export class BinaryAsset extends Asset {
  buffer: ArrayBuffer;

  override fromData (data: BinaryAssetData): void {
    super.fromData(data);
    if (data.buffer !== undefined) {
      this.buffer = data.buffer;
    }
  }
}
