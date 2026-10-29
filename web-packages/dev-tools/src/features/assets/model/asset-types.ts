import type { spec } from '@galacean/effects';
import type { SceneEditorData } from '../../scene/document/scene-types';

export const ASSET_ROOT = 'content';

export interface AssetEntry {
  id: string,
  projectId: string,
  parentId: string,
  name: string,
  kind: 'folder' | 'texture' | 'scene',
  createdAt: number,
  updatedAt: number,
  width?: number,
  height?: number,
  mime?: string,
  sourceName?: string,
  size?: number,
  favorite?: boolean,
  deletedAt?: number,
}

export interface AssetImage { id: string, kind: 'texture', blob: Blob, thumbnail: Blob }
export interface AssetScene {
  id: string,
  kind: 'scene',
  scene: spec.JSONScene,
  editor: SceneEditorData,
  textureReferences?: Record<string, Record<string, any>>,
}
export type AssetPayload = AssetImage | AssetScene;
export interface AssetCollection { id: string, name: string, assets: string[] }
export interface AssetBrowserPreferences {
  folder: string,
  view: 'tiles' | 'list' | 'columns',
  thumbnailSize: number,
  sourcesWidth: number,
  sources: boolean,
  showFolders: boolean,
  recursive: boolean,
  sort: 'name' | 'type' | 'size' | 'modified',
  descending: boolean,
  collections: AssetCollection[],
}
