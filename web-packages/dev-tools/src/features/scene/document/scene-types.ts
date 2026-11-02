import type { Keyframe, spec } from '@galacean/effects';

export interface SequenceChannelEditorData {
  group: string,
  axis: number,
  defaultValue: number,
  source: string,
  keys: (Keyframe & { tangentMode: 'auto' | 'user' | 'break' })[],
}
export interface SequenceEditorData {
  timelineId: string,
  version?: number,
  sections: Record<string, SequenceChannelEditorData[]>,
  /** Retain an explicit editing mode when position has no runtime curve. */
  positions?: Record<string, { mode: 'path' | 'separated', source: string }>,
}
export interface SceneFolder { id: string, name: string, parentId?: string }
export interface SceneHierarchyData { folders: SceneFolder[], itemFolders: Record<string, string> }
export interface SceneEditorData {
  objects: Record<string, Record<string, any>>,
  sequences?: Record<string, SequenceEditorData>,
  hierarchy?: SceneHierarchyData,
}
export interface SceneMetadata { id: string, name: string, updatedAt: number, parentId?: string, projectId?: string }
export interface StoredScene extends SceneMetadata { scene: spec.JSONScene, editor: SceneEditorData }
