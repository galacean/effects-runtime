import { EffectsObject } from '@galacean/effects';

export class EffectsPackage extends EffectsObject {
  fileSummary: fileSummary;
  exportObjects: EffectsObject[] = [];

  override toData () {
    this.taggedProperties.fileSummary = this.fileSummary;

    this.taggedProperties.exportObjects = [];
    for (const eObject of this.exportObjects) {
      eObject.toData();
      this.taggedProperties.exportObjects.push(eObject.taggedProperties);
    }
  }
}

interface fileSummary {
  guid: string,
}