import type { EffectsObject } from '@galacean/effects';

export class EffectsPackage {
  fileSummary: fileSummary;
  exportObjects: EffectsObject[] = [];
}

interface fileSummary {
  guid: string,
}