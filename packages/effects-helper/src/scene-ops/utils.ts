import type { spec } from '@galacean/effects';

export type SceneMutationFailureCode =
  | 'SCENE_PARSE_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'UNSUPPORTED_ELEMENT_TYPE'
  | 'ANIMATION_NOT_FOUND'
  | 'INVALID_INPUT';

export type SceneMutationSuccess<T> = {
  ok: true,
  scene: spec.JSONScene,
  data: T,
};

export type SceneMutationFailure = {
  ok: false,
  code: SceneMutationFailureCode,
  message: string,
};

export type SceneMutationResult<T> = SceneMutationSuccess<T> | SceneMutationFailure;

export function clone<T> (value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeScene (value: spec.JSONScene | string) {
  if (typeof value !== 'string') {
    return clone<spec.JSONScene>(value);
  }

  const parsed = JSON.parse(value);

  return clone<spec.JSONScene>(parsed);
}

export function isObjectWithId (value: unknown): value is { id: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return typeof (value as { id?: unknown }).id === 'string';
}

export function getItems (scene: spec.JSONScene) {
  if (!Array.isArray(scene.items)) {
    return [];
  }

  return scene.items.every(isObjectWithId) ? scene.items : [];
}

export function getCompositions (scene: spec.JSONScene) {
  if (!Array.isArray(scene.compositions)) {
    return [];
  }

  return scene.compositions.every(isObjectWithId) ? scene.compositions : [];
}

export function getComponents (scene: spec.JSONScene) {
  if (!Array.isArray(scene.components)) {
    return [];
  }

  return scene.components.every(isObjectWithId) ? scene.components : [];
}

export function isCompositionComponentData (value: unknown): value is spec.CompositionComponentData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<spec.CompositionComponentData>;

  return Array.isArray(candidate.items)
    && Array.isArray(candidate.sceneBindings)
    && Boolean(candidate.timelineAsset);
}
