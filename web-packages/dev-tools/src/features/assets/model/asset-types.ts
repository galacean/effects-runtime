import type { spec } from '@galacean/effects';
import type { SceneEditorData } from '../../scene/document/scene-types';

export const ASSET_ROOT = 'content';
export const ASSET_KINDS = ['folder', 'scene', 'texture', 'material', 'shader', 'sprite'] as const;
export type AssetKind = typeof ASSET_KINDS[number];
export type ObjectAssetKind = 'material' | 'shader' | 'sprite';
export type AssetPreviewMesh = 'sphere' | 'plane' | 'cube' | 'cylinder';
export type AssetObjectData = spec.EffectsObjectData & Record<string, any>;

export interface AssetEntry {
  id: string,
  projectId: string,
  parentId: string,
  name: string,
  kind: AssetKind,
  createdAt: number,
  updatedAt: number,
  width?: number,
  height?: number,
  mime?: string,
  sourceName?: string,
  size?: number,
  favorite?: boolean,
  deletedAt?: number,
  previewMesh?: AssetPreviewMesh,
}

export interface AssetImage { id: string, kind: 'texture', blob: Blob, thumbnail: Blob }
export interface AssetScene {
  id: string,
  kind: 'scene',
  scene: spec.JSONScene,
  editor: SceneEditorData,
  textureReferences?: Record<string, Record<string, any>>,
}
export interface AssetObject { id: string, kind: ObjectAssetKind, objects: AssetObjectData[], previewMesh?: AssetPreviewMesh }
export type AssetPayload = AssetImage | AssetScene | AssetObject;

export function isObjectAsset (payload: AssetPayload): payload is AssetObject {
  return payload.kind === 'material' || payload.kind === 'shader' || payload.kind === 'sprite';
}
export interface AssetCollection { id: string, name: string, assets: string[] }
export interface AssetBrowserPreferences {
  folder: string,
  view: 'tiles' | 'list' | 'columns',
  thumbnailSize: number,
  realtimeThumbnails: boolean,
  sourcesWidth: number,
  sources: boolean,
  showFolders: boolean,
  recursive: boolean,
  sort: 'name' | 'type' | 'size' | 'modified',
  descending: boolean,
  collections: AssetCollection[],
}
