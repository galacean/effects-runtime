import type { Database, spec } from '@galacean/effects';

/** Editor operations for preparing and listing external asset definitions. */
export interface EditorAssetDatabase extends Database {
  addEffectsObjectData(data: spec.EffectsObjectData): void,
  getEffectsObjectDataIds(): string[],
}
