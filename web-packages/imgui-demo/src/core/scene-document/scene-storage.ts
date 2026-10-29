import { glContext, spec, TextureSourceType } from '@galacean/effects';
import type { Keyframe } from '@galacean/effects';
import { AssetStorage, assetRequest, assetStorage } from '../asset-database/asset-storage';
import { ASSET_ROOT } from '../asset-database/asset-types';
import type { AssetEntry, AssetScene } from '../asset-database/asset-types';
import { blobDataURL } from '../asset-database/asset-data';
import { jsonData } from './scene-values';

export interface SequenceChannelEditorData {
  group: string,
  axis: number,
  defaultValue: number,
  source: string,
  keys: (Keyframe & { tangentMode: 'auto' | 'user' | 'break' })[],
}
export interface SequenceEditorData { timelineId: string, sections: Record<string, SequenceChannelEditorData[]> }
export interface SceneEditorData { objects: Record<string, Record<string, any>>, sequences?: Record<string, SequenceEditorData> }
export interface SceneMetadata { id: string, name: string, updatedAt: number, parentId?: string }
export interface StoredScene extends SceneMetadata { scene: spec.JSONScene, editor: SceneEditorData }

function metadata (entry: AssetEntry): SceneMetadata { return { id: entry.id, name: entry.name, updatedAt: entry.updatedAt, parentId: entry.parentId }; }

export class SceneStorage {
  readonly assets: AssetStorage;

  constructor (databaseName = 'effects-editor', legacyKey = 'effects-editor.scenes.v1') {
    this.assets = databaseName === 'effects-editor' && legacyKey === 'effects-editor.scenes.v1' ? assetStorage : new AssetStorage(databaseName, legacyKey, databaseName + '.legacy-content');
  }

  initialize (): Promise<void> { return this.assets.initialize(); }
  close (): Promise<void> { return this.assets.close(); }
  subscribe (listener: (entries: AssetEntry[]) => void): () => void { return this.assets.subscribe(listener); }

  async list (): Promise<SceneMetadata[]> {
    return (await this.assets.list()).filter(entry => entry.kind === 'scene' && !entry.deletedAt).map(metadata).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get (id: string): Promise<StoredScene | undefined> {
    const [entry, payload] = await Promise.all([this.assets.entry(id), this.assets.payload(id)]);

    if (entry?.kind !== 'scene' || entry.deletedAt || payload?.kind !== 'scene') { return; }
    const scene = jsonData(payload.scene), references = { ...payload.textureReferences };
    const textureAssets = new Map((await this.assets.list()).filter(asset => asset.kind === 'texture').map(asset => [asset.id, asset]));

    scene.textures = (scene.textures ?? []).filter(texture => {
      if (!texture.id || !textureAssets.has(texture.id)) { return true; }
      const { source, image, ...definition } = texture as any;

      references[texture.id] = definition;

      return false;
    });
    const textures = await Promise.all(Object.entries(references).map(async ([textureId, definition]) => {
      const image = await this.assets.image(textureId);

      if (!image) { throw new Error('A texture used by this scene is missing: ' + textureId); }

      return { flipY: true, minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
        ...definition, id: textureId, name: textureAssets.get(textureId)?.name ?? definition.name,
        dataType: spec.DataType.Texture, sourceType: TextureSourceType.image, source: await blobDataURL(image.blob) };
    }));

    scene.textures.push(...textures as any);

    return { ...metadata(entry), scene, editor: jsonData(payload.editor) };
  }

  async findByName (name: string, parentId = ASSET_ROOT): Promise<SceneMetadata | undefined> {
    const entry = (await this.assets.list()).find(entry => entry.kind === 'scene' && !entry.deletedAt && entry.parentId === parentId && entry.name.toLowerCase() === name.toLowerCase());

    return entry ? metadata(entry) : undefined;
  }

  async last (): Promise<StoredScene | undefined> {
    const id = await this.assets.setting<string>('lastSceneId');

    return id ? this.get(id) : undefined;
  }

  async save (record: StoredScene, folder?: string): Promise<void> {
    if (!record.id || !record.name.trim() || !Number.isFinite(record.updatedAt) || !record.scene || !record.editor?.objects) { throw new Error('The scene cannot be saved because its data is invalid.'); }
    const textureIds = new Set((await this.assets.list()).filter(entry => entry.kind === 'texture').map(entry => entry.id));
    const payload: AssetScene = { id: record.id, kind: 'scene', scene: jsonData(record.scene), editor: jsonData(record.editor), textureReferences: {} };

    payload.scene.textures = (payload.scene.textures ?? []).filter(texture => {
      if (!texture.id || !textureIds.has(texture.id)) { return true; }
      const { source, image, ...definition } = texture as any;

      payload.textureReferences![texture.id] = definition;

      return false;
    });
    await this.assets.mutate(async stores => {
      const previous = await assetRequest<AssetEntry | undefined>(stores.entries.get(record.id));
      const parentId = folder ?? previous?.parentId ?? ASSET_ROOT;
      const siblings = await assetRequest<AssetEntry[]>(stores.entries.index('parentId').getAll(parentId));

      if (previous && previous.kind !== 'scene') { throw new Error('This asset ID is already used by another resource.'); }
      if ((!previous || previous.deletedAt || previous.name !== record.name || previous.parentId !== parentId) && siblings.some(entry => entry.id !== record.id && !entry.deletedAt && entry.name.toLowerCase() === record.name.toLowerCase())) { throw new Error('An asset with that name already exists in this folder.'); }
      if (parentId !== ASSET_ROOT) {
        const parent = await assetRequest<AssetEntry | undefined>(stores.entries.get(parentId));

        if (parent?.kind !== 'folder' || parent.deletedAt) { throw new Error('Choose an existing content folder.'); }
      }
      const entry: AssetEntry = { ...previous, id: record.id, name: record.name, parentId, kind: 'scene', createdAt: previous?.createdAt ?? record.updatedAt, updatedAt: record.updatedAt, deletedAt: undefined };

      stores.entries.put(entry); stores.payloads.put(payload); stores.workspace.put({ key: 'lastSceneId', value: record.id });

      return [entry];
    });
  }

  async select (id: string): Promise<void> {
    await this.assets.mutate(stores => {
      stores.workspace.put({ key: 'lastSceneId', value: id });

      return [];
    });
  }
}
