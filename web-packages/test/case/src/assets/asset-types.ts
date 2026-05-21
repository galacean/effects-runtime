import type { spec } from '@galacean/effects';

export type SceneAssetItem = {
  name: string,
  url: string,
  threshold?: number,
};

export type DynamicSceneAssetItem = SceneAssetItem & {
  variables: spec.TemplateVariables,
};
