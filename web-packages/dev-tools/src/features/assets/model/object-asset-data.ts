import { generateGUID, itemFrag, itemVert, spec } from '@galacean/effects';
import type { AssetEntry, AssetObject, AssetObjectData, ObjectAssetKind } from './asset-types';

const SPRITE_DATA_TYPE = 'Sprite' as spec.DataType;
const BUILTIN_IDS = new Set<string>(Object.values(spec.BuiltinObjectGUID));

export const OBJECT_ASSET_TYPES = { material: spec.DataType.Material, shader: spec.DataType.Shader, sprite: SPRITE_DATA_TYPE };
export const DEFAULT_SHADER_PROPERTIES = '_Color("Color", Color) = (1, 1, 1, 1)\n_MainTex("Texture", 2D) = "white"';

export function newObjectAsset (kind: ObjectAssetKind, id: string, name: string, reference?: string): AssetObject {
  if (kind === 'shader') { return { id, kind, objects: [{ id, name, dataType: spec.DataType.Shader, vertex: itemVert, fragment: itemFrag, properties: DEFAULT_SHADER_PROPERTIES }] }; }
  if (kind === 'sprite') { return { id, kind, objects: [{ id, name, dataType: SPRITE_DATA_TYPE, rect: [0, 0, 1, 1], rotation: 0, ...(reference ? { texture: { id: reference } } : {}) }] }; }
  const shader = reference ? undefined : newObjectAsset('shader', generateGUID(), name + '_Shader').objects[0];

  return { id, kind, objects: [{ id, name, dataType: spec.DataType.Material, shader: { id: reference ?? shader!.id },
    stringTags: { RenderType: spec.RenderType.Transparent, RenderFace: spec.RenderFace.Both }, macros: [], ints: {}, floats: { ZWrite: 0, ZTest: 0 },
    vector4s: { _TexOffset: { x: 0, y: 0, z: 1, w: 1 }, _TexParams: { x: 1, y: 1, z: 1, w: 0 } }, colors: { _Color: { r: 1, g: 1, b: 1, a: 1 } },
    textures: { _MainTex: { texture: { id: spec.BuiltinObjectGUID.WhiteTexture } } } }, ...(shader ? [shader] : [])] };
}

export function objectReferences (value: unknown, result = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') { return result; }
  if (!Array.isArray(value)) {
    const data = value as Record<string, unknown>;

    if (Object.keys(data).length === 1 && typeof data.id === 'string') {
      result.add(data.id);

      return result;
    }
  }
  Object.values(value).forEach(child => objectReferences(child, result));

  return result;
}

export function validateObjectAsset (payload: AssetObject): void {
  if (payload.previewMesh !== undefined && (payload.kind !== 'material' || !['sphere', 'plane', 'cube', 'cylinder'].includes(payload.previewMesh))) { throw new Error('The preview mesh is invalid.'); }
  if (!Array.isArray(payload.objects) || !payload.objects.length || payload.objects.length > 1024 ||
    payload.objects.some(object => !object || typeof object.id !== 'string' || typeof object.dataType !== 'string') ||
    new Set(payload.objects.map(object => object.id)).size !== payload.objects.length || payload.objects.some(object => BUILTIN_IDS.has(object.id)) ||
    payload.objects.find(object => object.id === payload.id)?.dataType !== OBJECT_ASSET_TYPES[payload.kind]) { throw new Error('The asset definition is invalid.'); }
  for (const object of payload.objects) {
    if (object.id !== payload.id && (payload.kind !== 'material' || object.dataType !== spec.DataType.Shader)) { throw new Error('Only material assets can own a private shader.'); }
    if (object.dataType === spec.DataType.Shader && (typeof object.vertex !== 'string' || typeof object.fragment !== 'string' || !object.vertex.trim() || !object.fragment.trim())) { throw new Error('A shader requires vertex and fragment source.'); }
    if (object.dataType === SPRITE_DATA_TYPE && (!Array.isArray(object.rect) || object.rect.length !== 4 || object.rect.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value)) ||
      object.rect[0] < 0 || object.rect[1] < 0 || object.rect[2] <= 0 || object.rect[3] <= 0 || object.rect[0] + object.rect[object.rotation ? 3 : 2] > 1.000001 || object.rect[1] + object.rect[object.rotation ? 2 : 3] > 1.000001 || ![0, 1].includes(object.rotation))) { throw new Error('Sprite UV coordinates must describe a region inside the texture.'); }
    if (object.dataType === spec.DataType.Material) {
      for (const key of ['stringTags', 'ints', 'floats', 'vector4s', 'colors', 'textures']) {
        if (!object[key] || typeof object[key] !== 'object' || Array.isArray(object[key])) { throw new Error('The material parameter data is invalid.'); }
      }
      if (!Array.isArray(object.macros)) { throw new Error('The material macro data is invalid.'); }
      for (const values of [object.ints, object.floats]) {
        if (Object.values(values).some(value => typeof value !== 'number' || !Number.isFinite(value))) { throw new Error('Material numeric parameters must be finite numbers.'); }
      }
    }
    for (const dependency of objectAssetDependencies({ ...payload, objects: [object] })) {
      const owned = payload.objects.find(candidate => candidate.id === dependency.id);

      if (typeof dependency.id !== 'string' || !dependency.id || owned && owned.dataType !== (dependency.kind === 'shader' ? spec.DataType.Shader : spec.DataType.Texture)) { throw new Error('The asset reference has an incompatible type.'); }
    }
  }
}

export function objectAssetDependencies (payload: AssetObject): { id: string, kind: 'shader' | 'texture' }[] {
  return payload.objects.flatMap(object => {
    if (object.dataType === spec.DataType.Material) {
      return [{ id: object.shader?.id, kind: 'shader' as const }, ...Object.values(object.textures ?? {}).map((value: any) => ({ id: value?.texture?.id, kind: 'texture' as const }))];
    }
    if (object.dataType === SPRITE_DATA_TYPE && object.texture) { return [{ id: object.texture.id, kind: 'texture' as const }]; }

    return [];
  });
}

export function validateObjectAssetReferences (payload: AssetObject, lookup: (id: string) => AssetEntry | undefined): void {
  const owned = new Set(payload.objects.map(object => object.id));

  for (const { id, kind } of objectAssetDependencies(payload)) {
    if (owned.has(id) || BUILTIN_IDS.has(id)) { continue; }
    const entry = lookup(id);

    if (entry?.kind !== kind) { throw new Error('The asset references a missing or incompatible ' + kind + ': ' + id); }
  }
}

export function copyObjectAsset (payload: AssetObject, id: string, assetMapping = new Map<string, string>()): AssetObject {
  const mapping = new Map([...assetMapping, ...payload.objects.map(object => [object.id, object.id === payload.id ? id : generateGUID()] as const)]);
  const remap = (value: any): any => {
    if (Array.isArray(value)) { return value.map(remap); }
    if (value && typeof value === 'object') { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'id' && typeof item === 'string' ? mapping.get(item) ?? item : remap(item)])); }

    return value;
  };

  return { ...payload, id, objects: payload.objects.map(object => remap(object) as AssetObjectData) };
}
