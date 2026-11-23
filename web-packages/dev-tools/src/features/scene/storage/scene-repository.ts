import { glContext, spec, TextureSourceType } from '@galacean/effects';
import { blobDataURL } from '../../../platform/browser-files/blob-data-url';
import { requestResult } from '../../../platform/browser-storage/indexeddb';
import type { AssetEntry, AssetScene } from '../../assets/model/asset-types';
import { ASSET_ROOT } from '../../assets/model/asset-types';
import { validateAssetWrite } from '../../assets/storage/asset-write-validation';
import { resolveObjectAssets } from '../../assets/storage/object-asset-resolver';
import { objectReferences } from '../../assets/model/object-asset-data';
import { WorkspaceRepository, workspaceRepository } from '../../assets/storage/workspace-repository';
import { jsonData } from '../serialization/scene-values';

import type { SceneMetadata, StoredScene } from '../document/scene-types';

function metadata (entry: AssetEntry): SceneMetadata { return { id: entry.id, projectId: entry.projectId, name: entry.name, updatedAt: entry.updatedAt, parentId: entry.parentId }; }

export class SceneRepository {
  readonly assets: WorkspaceRepository;

  constructor (databaseName = 'effects-editor', legacyKey = 'effects-editor.scenes.v1') {
    this.assets = databaseName === 'effects-editor' && legacyKey === 'effects-editor.scenes.v1' ? workspaceRepository : new WorkspaceRepository(databaseName, legacyKey, databaseName + '.legacy-content');
  }

  initialize (): Promise<void> { return this.assets.initialize(); }
  close (): Promise<void> { return this.assets.close(); }
  subscribe (listener: (entries: AssetEntry[]) => void): () => void { return this.assets.subscribe(listener); }

  async list (): Promise<SceneMetadata[]> {
    return (await this.assets.list()).filter(entry => entry.kind === 'scene' && !entry.deletedAt).map(metadata).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get (id: string, projectId?: string): Promise<StoredScene | undefined> {
    await this.initialize(); projectId ??= this.assets.projectId;
    const [entry, payload] = await Promise.all([this.assets.entry(id, projectId), this.assets.payload(id, projectId)]);

    if (entry?.kind !== 'scene' || entry.deletedAt || payload?.kind !== 'scene') { return; }
    const scene = jsonData(payload.scene), references = { ...payload.textureReferences };
    const assets = await this.assets.list(projectId);
    const textureAssets = new Map(assets.filter(asset => asset.kind === 'texture').map(asset => [asset.id, asset]));
    const objects = await resolveObjectAssets([scene, payload.editor], assets, assetId => this.assets.payload(assetId, projectId));

    for (const definition of objects) {
      const table = definition.dataType === spec.DataType.Material ? 'materials' : definition.dataType === spec.DataType.Shader ? 'shaders' : 'miscs';
      const data = (scene[table] ??= []) as any[];
      const index = data.findIndex(object => object.id === definition.id);

      if (index >= 0) { data[index] = definition; } else { data.push(definition); }
    }
    for (const id of objectReferences(objects)) { if (textureAssets.has(id)) { references[id] ??= {}; } }

    scene.textures = (scene.textures ?? []).filter(texture => {
      if (!texture.id || !textureAssets.has(texture.id)) { return true; }
      const { source, image, ...definition } = texture as any;

      references[texture.id] = definition;

      return false;
    });
    const textures = await Promise.all(Object.entries(references).map(async ([textureId, definition]) => {
      const image = await this.assets.image(textureId, projectId);

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

  async initial (projectId?: string): Promise<StoredScene | undefined> {
    await this.initialize(); projectId ??= this.assets.projectId;
    const project = await this.assets.getProject(projectId);
    const last = await this.assets.setting<string>('lastSceneId', projectId);

    for (const id of [...new Set([project?.startupSceneId, last].filter((id): id is string => !!id))]) {
      const stored = await this.get(id, projectId);

      if (stored) { return stored; }
    }
    const scene = (await this.assets.list(projectId)).find(entry => entry.kind === 'scene' && !entry.deletedAt);

    return scene ? this.get(scene.id, projectId) : undefined;
  }

  async save (record: StoredScene, folder?: string): Promise<void> {
    if (!record.id || !record.name.trim() || !Number.isFinite(record.updatedAt) || !record.scene || !record.editor?.objects) { throw new Error('The scene cannot be saved because its data is invalid.'); }
    await this.initialize();
    const projectId = record.projectId ?? this.assets.projectId;
    const textureIds = new Set((await this.assets.list(projectId)).filter(entry => entry.kind === 'texture').map(entry => entry.id));
    const payload: AssetScene = { id: record.id, kind: 'scene', scene: jsonData(record.scene), editor: jsonData(record.editor), textureReferences: {} };

    payload.scene.textures = (payload.scene.textures ?? []).filter(texture => {
      if (!texture.id || !textureIds.has(texture.id)) { return true; }
      const { source, image, ...definition } = texture as any;

      payload.textureReferences![texture.id] = definition;

      return false;
    });
    await this.assets.mutate(async stores => {
      const previous = await requestResult<AssetEntry | undefined>(stores.entries.get(record.id));
      const parentId = folder ?? previous?.parentId ?? ASSET_ROOT;

      if (previous && previous.kind !== 'scene') { throw new Error('This asset ID is already used by another resource.'); }
      const entry: AssetEntry = { ...previous, id: record.id, projectId, name: record.name, parentId, kind: 'scene', createdAt: previous?.createdAt ?? record.updatedAt, updatedAt: record.updatedAt, deletedAt: undefined };

      await validateAssetWrite(stores, [entry], [payload]);
      const key = projectId + ':lastSceneId';

      stores.entries.put(entry); stores.payloads.put(payload); stores.workspace.put({ key, value: record.id });

      return [entry];
    }, projectId);
  }

  async select (id: string): Promise<void> {
    await this.initialize();
    const projectId = this.assets.projectId;

    await this.assets.mutate(stores => {
      const key = projectId + ':lastSceneId';

      stores.workspace.put({ key, value: id });

      return [];
    }, projectId);
  }
}
