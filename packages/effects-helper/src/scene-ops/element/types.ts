import type { spec } from '@galacean/effects';
import { type SceneMutationResult } from '../utils';

export type ElementContainerType = 'root' | 'composition';

export type ElementMatch = {
  index: number,
  element: spec.VFXItemData,
  container: spec.VFXItemData[] | spec.DataPath[],
  containerType: ElementContainerType,
  component?: spec.CompositionComponentData,
};

export type Vec2Like = { x: number, y: number };
export type Vec3Like = { x: number, y: number, z: number };

export type ElementTransformPatch = {
  position?: Vec3Like,
  rotation?: Vec3Like,
  scale?: Vec3Like,
  size?: Vec2Like,
  anchor?: Vec2Like,
};

export type ReparentElementInput = {
  scene: spec.JSONScene | string,
  elementId: string,
  parentId?: string | null,
};

export type ReorderElementInput = {
  scene: spec.JSONScene | string,
  elementId: string,
  action: 'to_front' | 'to_back' | 'forward' | 'backward' | 'before' | 'after',
  targetElementId?: string,
};

export type PatchTransformInput = {
  scene: spec.JSONScene | string,
  elementId: string,
  transform: ElementTransformPatch,
};

export type ElementMutationFailureCode =
  | 'SCENE_PARSE_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'INVALID_INPUT';

export type PatchTransformResult = SceneMutationResult<{
  elementId: string,
}>;

export type ReparentElementResult = SceneMutationResult<{
  elementId: string,
  parentId: string | null,
}>;

export type ReorderElementResult = SceneMutationResult<{
  elementId: string,
  fromIndex: number,
  toIndex: number,
  changed: boolean,
  containerType: ElementContainerType,
}>;
