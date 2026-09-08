import type { SceneResources } from './scene-resources';
import type { Asset, VFXItem, spec } from '@galacean/effects';

/** Composition metadata, independent of a Player or an input JSON. */
export interface SceneComposition {
  root: VFXItem,
  camera: spec.CameraOptions,
  previewSize?: [number, number],
  startTime?: number,
}

export const sceneAssetCollections = ['materials', 'shaders', 'geometries', 'animations', 'miscs', 'textures'] as const;
export type SceneAssetCollection = typeof sceneAssetCollections[number];

export interface EmbeddedSceneAsset {
  asset: Asset,
  collection: SceneAssetCollection,
}

export interface SceneInstance {
  root: VFXItem,
  id: string,
  camera: spec.CameraOptions,
  previewSize?: [number, number],
  startTime?: number,
  name: string,
  duration: number,
  endBehavior: spec.EndBehavior,
}

export interface SceneGraph {
  instances?: SceneInstance[],
  resources?: SceneResources,
  assets?: EmbeddedSceneAsset[],
  compositions: SceneComposition[],
  compositionId?: string,
  renderSettings?: spec.RenderSettings,
}
