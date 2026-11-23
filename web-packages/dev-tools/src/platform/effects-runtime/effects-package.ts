import type { EffectsObject, spec } from '@galacean/effects';
import { SerializationHelper } from '@galacean/effects';

export class EffectsPackage {
  fileSummary: PackageSummary;
  exportObjects: EffectsObject[] = [];

  toData () {
    const effectsPackageData: spec.EffectsPackageData = {
      fileSummary: this.fileSummary,
      exportObjects: [],
    };

    for (const obj of this.exportObjects) {
      effectsPackageData.exportObjects.push(SerializationHelper.serialize(obj) as spec.EffectsObjectData);
    }

    return effectsPackageData;
  }
}

export interface PackageSummary {
  guid: string,
  assetType: string,
}
