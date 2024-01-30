import { EffectsObject } from '@galacean/effects';

export class EffectsPackage extends EffectsObject {
  fileSummary: fileSummary;
  exportObjects: EffectsObject[] = [];

  override toData () {
    this.taggedProperties.fileSummary = this.fileSummary;
    this.taggedProperties.exportObjects = [];

    for (const obj of this.exportObjects) {
      obj.toData();
      this.taggedProperties.exportObjects.push(obj.taggedProperties);
    }
  }
}

interface fileSummary {
  guid: string,
}
