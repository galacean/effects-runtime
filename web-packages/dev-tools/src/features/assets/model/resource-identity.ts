import type { Engine } from '@galacean/effects';
import { Material, Shader, Sprite, Texture, spec } from '@galacean/effects';
import { assetLibrary } from '../asset-library';
import type { AssetKind } from './asset-types';

export type ResourceKind = Exclude<AssetKind, 'folder' | 'scene'>;
export type Resource = Material | Shader | Sprite | Texture;
export interface ResourceIdentity { id: string, kind: ResourceKind, name: string }

const DATA_KINDS: Record<string, ResourceKind> = { Material: 'material', Shader: 'shader', Sprite: 'sprite', Texture: 'texture' };
const BUILTIN_TEXTURES: Record<string, string> = {
  [spec.BuiltinObjectGUID.WhiteTexture]: 'White',
  [spec.BuiltinObjectGUID.EmptyTexture]: 'Transparent',
};

export function isContentResource (id: string, kind: ResourceKind): boolean {
  const entry = assetLibrary.entry(id);

  return entry?.kind === kind && entry.projectId === assetLibrary.projectId && !entry.deletedAt;
}

/** Resource identity comes from authored definitions and explicit built-ins, never the live object table. */
export function resourceIdentity (engine: Engine, id: string): ResourceIdentity | undefined {
  const entry = assetLibrary.entry(id);

  if (entry) { return entry.kind !== 'folder' && entry.kind !== 'scene' && isContentResource(id, entry.kind) ? { id, kind: entry.kind, name: entry.name } : undefined; }
  if (BUILTIN_TEXTURES[id]) { return { id, kind: 'texture', name: BUILTIN_TEXTURES[id] }; }
  const data = engine.assetServer.findEffectsObjectData(id);
  const kind = data && DATA_KINDS[data.dataType];

  return kind ? { id, kind, name: (data as { name?: string }).name || data.dataType + ' ' + id.slice(0, 8) } : undefined;
}

export function isResource (value: unknown): value is Resource {
  return value instanceof Material || value instanceof Shader || value instanceof Sprite || value instanceof Texture;
}

export function isPersistentResource (value: unknown, engine: Engine, kind?: ResourceKind): value is Resource {
  if (!isResource(value) || value.engine !== engine || !value.isRegistered || value instanceof Texture && value.isDestroyed) { return false; }
  const actual = value instanceof Material ? 'material' : value instanceof Shader ? 'shader' : value instanceof Sprite ? 'sprite' : 'texture';

  return (!kind || kind === actual) && resourceIdentity(engine, value.getInstanceId())?.kind === actual;
}

export function resourceCandidates (engine: Engine, kind: ResourceKind): ResourceIdentity[] {
  const ids = new Set([...assetLibrary.entries.map(entry => entry.id), ...Object.keys(engine.assetServer.jsonSceneData), ...Object.keys(BUILTIN_TEXTURES)]);

  return [...ids].map(id => resourceIdentity(engine, id)).filter((entry): entry is ResourceIdentity => entry?.kind === kind);
}
