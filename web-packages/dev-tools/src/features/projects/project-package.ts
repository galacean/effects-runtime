import { generateGUID } from '@galacean/effects';
import { blobDataURL } from '../../platform/browser-files/blob-data-url';
import type { AssetBrowserPreferences, AssetEntry, AssetPayload, AssetScene } from '../assets/model/asset-types';
import { ASSET_ROOT } from '../assets/model/asset-types';
import type { ProjectRecord } from './project-types';

interface PackageImage { id: string, kind: 'texture', source: string, thumbnail: string }
interface ProjectPackage {
  format: 'effects-editor-project',
  version: 1,
  project: ProjectRecord,
  entries: AssetEntry[],
  payloads: (AssetScene | PackageImage)[],
  preferences?: AssetBrowserPreferences,
  lastSceneId?: string,
}
export interface ProjectSnapshot { project: ProjectRecord, entries: AssetEntry[], payloads: AssetPayload[], preferences?: AssetBrowserPreferences, lastSceneId?: string }

export async function encodeProject (snapshot: ProjectSnapshot): Promise<Blob> {
  const payloads = await Promise.all(snapshot.payloads.map(async payload => {
    if (payload.kind === 'scene') { return payload; }
    const mime = snapshot.entries.find(entry => entry.id === payload.id)?.mime ?? 'image/png';
    const source = payload.blob.type.startsWith('image/') ? payload.blob : new Blob([payload.blob], { type: mime });

    return { id: payload.id, kind: 'texture' as const, source: await blobDataURL(source), thumbnail: await blobDataURL(payload.thumbnail) };
  }));
  const archive: ProjectPackage = { ...snapshot, format: 'effects-editor-project', version: 1, payloads };

  return new Blob([JSON.stringify(archive)], { type: 'application/json' });
}

function imageBlob (source: string): Blob {
  const match = /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(source);

  if (!match) { throw new Error('The project contains an invalid image.'); }
  const binary = atob(match[2]), bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) { bytes[index] = binary.charCodeAt(index); }

  return new Blob([bytes], { type: match[1] });
}

export async function decodeProject (file: File, existingNames: string[]): Promise<ProjectSnapshot> {
  const archive = JSON.parse(await file.text()) as ProjectPackage;

  if (archive?.format !== 'effects-editor-project' || archive.version !== 1 || !archive.project ||
    typeof archive.project.name !== 'string' || !archive.project.name.trim() || archive.project.name.length > 80 ||
    !Array.isArray(archive.entries) || !Array.isArray(archive.payloads)) { throw new Error('This file is not a supported project package.'); }
  const entries = new Map<string, AssetEntry>(), payloads = new Map<string, AssetPayload>();

  for (const entry of archive.entries) {
    if (!entry?.id || typeof entry.id !== 'string' || entries.has(entry.id) || !['folder', 'texture', 'scene'].includes(entry.kind) ||
      typeof entry.name !== 'string' || !entry.name.trim() || /[/\\]/.test(entry.name) || Array.from(entry.name).some(character => character.charCodeAt(0) < 32) || typeof entry.parentId !== 'string') {
      throw new Error('The project contains invalid or duplicate assets.');
    }
    entries.set(entry.id, entry);
  }
  for (const entry of entries.values()) {
    const visited = new Set([entry.id]);
    let parentId = entry.parentId;

    while (parentId !== ASSET_ROOT) {
      const parent = entries.get(parentId);

      if (!parent || parent.kind !== 'folder' || visited.has(parentId)) { throw new Error('The project folder structure is invalid.'); }
      visited.add(parentId); parentId = parent.parentId;
    }
  }
  for (const payload of archive.payloads) {
    const entry = payload && entries.get(payload.id);

    if (!entry || entry.kind === 'folder' || entry.kind !== payload.kind || payloads.has(payload.id)) { throw new Error('The project contains invalid asset data.'); }
    if (payload.kind === 'texture') {
      payloads.set(payload.id, { id: payload.id, kind: 'texture', blob: imageBlob(payload.source), thumbnail: imageBlob(payload.thumbnail) });
    } else {
      if (!payload.scene?.compositions || !Array.isArray(payload.scene.components) || !payload.editor?.objects) { throw new Error('A project scene is invalid.'); }
      for (const textureId of Object.keys(payload.textureReferences ?? {})) {
        if (entries.get(textureId)?.kind !== 'texture') { throw new Error('A scene references a texture that is missing from the project.'); }
      }
      payloads.set(payload.id, payload);
    }
  }
  if ([...entries.values()].some(entry => entry.kind !== 'folder' && !payloads.has(entry.id))) { throw new Error('An asset is missing from the project package.'); }
  const mapping = new Map([...entries.keys()].map(id => [id, generateGUID()]));
  const mappedId = (id: string): string => {
    const separator = id.indexOf(':');
    const owner = separator > 0 ? mapping.get(id.slice(0, separator)) : undefined;

    return mapping.get(id) ?? (owner ? owner + id.slice(separator) : id);
  };
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') { return; }
    if (Array.isArray(value)) {
      value.forEach(collect);

      return;
    }
    const object = value as Record<string, unknown>;

    if (typeof object.id === 'string' && !mapping.has(object.id)) {
      const owner = object.id.split(':')[0];

      if (owner !== object.id && /^[\da-f-]{32,36}$/i.test(owner) && !mapping.has(owner)) { mapping.set(owner, generateGUID()); }
      mapping.set(object.id, mappedId(object.id) === object.id ? generateGUID() : mappedId(object.id));
    }
    Object.values(object).forEach(collect);
  };

  for (const payload of payloads.values()) { if (payload.kind === 'scene') { collect(payload.scene); } }
  const textFields = new Set(['name', 'text', 'description', 'source', 'vertex', 'fragment']);
  const remap = (value: any, field = ''): any => {
    if (typeof value === 'string') { return textFields.has(field) ? value : mappedId(value); }
    if (Array.isArray(value)) { return value.map(entry => remap(entry, field)); }
    if (value && typeof value === 'object') { return Object.fromEntries(Object.entries(value).map(([key, entry]) => [mappedId(key), remap(entry, key)])); }

    return value;
  };
  const now = Date.now(), projectId = generateGUID(), names = new Set(existingNames.map(name => name.toLowerCase()));
  const originalName = archive.project.name.trim();
  let name = originalName, suffix = 1;

  while (names.has(name.toLowerCase())) { name = originalName.slice(0, 70) + '_' + suffix++; }
  const startup = entries.get(archive.project.startupSceneId ?? '');
  const project: ProjectRecord = { id: projectId, name, description: typeof archive.project.description === 'string' ? archive.project.description.slice(0, 4096) : '',
    startupSceneId: startup?.kind === 'scene' && !startup.deletedAt ? mapping.get(startup.id) : undefined, createdAt: now, updatedAt: now, lastOpenedAt: now };
  let preferences: AssetBrowserPreferences | undefined;

  if (archive.preferences) {
    const saved = archive.preferences;

    if (!['tiles', 'list', 'columns'].includes(saved.view) || !Number.isFinite(saved.thumbnailSize) || !Number.isFinite(saved.sourcesWidth) ||
      !Array.isArray(saved.collections) || saved.collections.some(collection => !collection || typeof collection.name !== 'string' || !Array.isArray(collection.assets) || collection.assets.some(id => !entries.has(id)))) {
      throw new Error('The project browser settings are invalid.');
    }
    const folder = entries.get(saved.folder);

    preferences = { ...saved, folder: folder?.kind === 'folder' && !folder.deletedAt ? mapping.get(folder.id)! : ASSET_ROOT,
      collections: saved.collections.map(collection => ({ id: generateGUID(), name: collection.name, assets: collection.assets.map(id => mapping.get(id)!) })) };
  }
  const lastScene = entries.get(archive.lastSceneId ?? '');

  return {
    project, preferences, lastSceneId: lastScene?.kind === 'scene' && !lastScene.deletedAt ? mapping.get(lastScene.id) : undefined,
    entries: [...entries.values()].map(entry => ({ ...entry, id: mapping.get(entry.id)!, projectId,
      parentId: entry.parentId === ASSET_ROOT ? ASSET_ROOT : mapping.get(entry.parentId)!, createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : now, updatedAt: now })),
    payloads: [...payloads.values()].map(payload => payload.kind === 'scene' ? remap(payload) as AssetScene : { ...payload, id: mapping.get(payload.id)! }),
  };
}
