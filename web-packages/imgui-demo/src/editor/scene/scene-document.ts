import { Asset, AssetManager, getClass, PluginSystem, VFXItem, spec } from '@galacean/effects';
import type { Engine, EffectsObject } from '@galacean/effects';
import { Control, Label, UIControl } from '@galacean/effects-plugin-gui';
import { SceneSerializer } from './scene-serializer';
import { sceneAssetCollections } from './scene-graph';
import type { SceneGraph, EmbeddedSceneAsset, SceneAssetCollection } from './scene-graph';
import { EditorContent } from '../content';
import { JsonSceneCooker } from '../cooker/json-scene-cooker';
import { EditorScene } from './editor-scene';

/** Owns the editable objects rendered by the scene viewport. The Engine is borrowed. */
export class SceneDocument {
  readonly scene: SceneGraph;
  private revision = 0;
  private savedRevision = 0;
  private viewport?: EditorScene;
  private playbackData?: spec.JSONScene;
  private assetManager?: AssetManager;
  private resources: EffectsObject[] = [];
  fileHandle?: FileSystemFileHandle;

  static async open (engine: Engine, data: spec.JSONScene | string, name = 'scene.json'): Promise<SceneDocument> {
    const manager = new AssetManager();
    const loaded = await manager.loadScene(typeof data === 'string' ? data : structuredClone(data), engine.renderer).catch(error => {
      manager.dispose();
      throw error;
    });
    const normalized = loaded.jsonScene;
    const playbackData = structuredClone(normalized);
    const baseURL = typeof data === 'string' ? new URL(data, location.href).href : location.href;

    // Checkpoints may be replayed as JSON, so they must not depend on the URL's directory.
    for (const image of playbackData.images as spec.CompressedImage[]) {
      for (const key of ['url', 'webp', 'avif', 'ktx2'] as const) {
        const url = image[key];

        if (url) {image[key] = new URL(url, baseURL).href;}
      }
    }
    for (const binary of playbackData.bins ?? []) {binary.url = new URL(binary.url, baseURL).href;}
    for (const font of playbackData.fonts ?? []) {
      if ('fontURL' in font && font.fontURL) {font.fontURL = new URL(font.fontURL, baseURL).href;}
    }

    const assets: EmbeddedSceneAsset[] = [];
    let records: { collection: SceneAssetCollection, record: spec.EffectsObjectData }[] = [];

    try {
      PluginSystem.notifyAssetsLoadFinish(loaded, manager.options, engine);
      const previousRecords = new Map(Object.entries(engine.jsonSceneData));

      engine.assetService.prepareAssets(loaded, loaded.assets);
      records = sceneAssetCollections.flatMap(collection =>
        (normalized[collection] ?? []).map(record => {
          if (!record.id) {throw new Error('Embedded scene assets require an ID.');}

          return { collection, record: engine.jsonSceneData[record.id] ?? record };
        }));
      const listedIds = new Set(records.map(({ record }) => record.id));
      const collections: Partial<Record<spec.DataType, SceneAssetCollection>> = {
        [spec.DataType.Geometry]: 'geometries',
        [spec.DataType.Material]: 'materials',
        [spec.DataType.Shader]: 'shaders',
        [spec.DataType.Texture]: 'textures',
        [spec.DataType.AnimationClip]: 'animations',
        [spec.DataType.AnimationGraphAsset]: 'animations',
      };

      // Binary packages publish asset records through prepareAssets too. They are
      // absent from the JSON collections, but must be ready before tree validation.
      for (const record of Object.values(engine.jsonSceneData)) {
        if (listedIds.has(record.id) || previousRecords.get(record.id) === record) {continue;}
        const Type = getClass(record.dataType);

        if (!Type || !(Type.prototype instanceof Asset)) {continue;}
        records.push({ collection: collections[record.dataType] ?? 'miscs', record });
      }
      // Publish every embedded asset identity before Content resolves dependencies.
      for (const { record } of records) {
        const existing = engine.content.getAsset(record.id);

        if (existing) {engine.content.unloadAsset(existing);}
        engine.addEffectsObjectData(record);
      }
      for (const { collection, record } of records) {
        const asset = await engine.content.load(record.id);

        if (!asset) {throw new Error(`Failed to load embedded scene asset '${record.id}'.`);}
        assets.push({ asset, collection });
      }
      if (engine.content instanceof EditorContent) {
        await engine.content.loadSceneAssets(normalized);
      }
      let document: SceneDocument;

      if (normalized.items.some(item => item.type === spec.ItemType.composition)) {
        // Use the runtime's definition/instance expansion for precompositions.
        const composition = new EditorScene(engine, loaded);
        const metadata = normalized.compositions.find(entry => entry.id === normalized.compositionId)!;

        composition.sceneRoot.name = metadata.name;
        document = new SceneDocument(engine, { compositions: [{ ...metadata, root: composition.sceneRoot }],
          compositionId: metadata.id, renderSettings: normalized.renderSettings }, name);
        document.viewport = composition;
      } else {
        const tree = { ...normalized, images: [], bins: [] };

        for (const collection of sceneAssetCollections) {tree[collection] = [];}
        document = new SceneDocument(engine, tree, name);
      }
      document.scene.assets = assets;
      document.playbackData = playbackData;
      document.assetManager = manager;
      document.resources = [...Object.keys(loaded.assets), ...(normalized.bins ?? []).map(binary => binary.id)]
        .filter((id): id is string => !!id).map(id => engine.objectInstance[id]).filter(Boolean);

      return document;
    } catch (error) {
      for (const { record } of records) {
        const asset = engine.content.getAsset(record.id);

        if (asset) {engine.content.unloadAsset(asset);}
        delete engine.jsonSceneData[record.id];
      }
      for (const id of [...Object.keys(loaded.assets), ...(normalized.bins ?? []).map(binary => binary.id)]) {
        if (!id) {continue;}
        engine.objectInstance[id]?.dispose();
        delete engine.jsonSceneData[id];
      }
      manager.dispose();
      throw error;
    }
  }

  /** Reload/playback checkpoint only. Saving always serializes the live scene tree. */
  restoreData (): spec.JSONScene {
    return this.revision === 0 && this.playbackData ? structuredClone(this.playbackData) : this.snapshot();
  }

  async previewData (): Promise<spec.JSONScene> {
    const content = this.engine.content;
    const snapshot = this.restoreData();

    return content instanceof EditorContent ? new JsonSceneCooker(content).cook(snapshot) : snapshot;
  }

  constructor (readonly engine: Engine, data: spec.JSONScene | SceneGraph, public name = 'scene.json') {
    this.scene = 'items' in data ? SceneSerializer.deserialize(data, engine) : data;
    try {
      for (const { root } of this.scene.compositions) {
        if (root.getComponent(UIControl)) {
          throw new Error('The composition root cannot have a UIControl. Place it on a child item.');
        }
      }
      if ('items' in data) {SceneSerializer.initialize(this.scene);}
    } catch (error) {
      for (const { root } of this.scene.compositions) {root.dispose();}
      throw error;
    }
  }

  get root (): VFXItem {
    return this.scene.compositions.find(entry => entry.root.getInstanceId() === this.scene.compositionId)!.root;
  }

  snapshot (): spec.JSONScene {
    if (this.playbackData?.images.length || this.playbackData?.bins?.length) {
      throw new Error('Saving embedded image and binary resources is not supported yet.');
    }

    return SceneSerializer.serialize(this.scene);
  }

  serialize (): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  get isDirty (): boolean {
    return this.revision !== this.savedRevision;
  }

  async save (handle: FileSystemFileHandle): Promise<void> {
    const revision = this.revision;
    const snapshot = this.serialize();
    const writable = await handle.createWritable();

    try {
      await writable.write(snapshot);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => {});
      throw error;
    }
    this.fileHandle = handle;
    this.name = handle.name;
    this.markSaved(revision);
  }

  get currentRevision (): number { return this.revision; }

  markSaved (revision = this.revision): void {
    this.savedRevision = revision;
  }

  markModified (): void {
    this.revision++;
  }

  show (): void {
    if (!this.viewport) {
      const composition = this.scene.compositions.find(entry => entry.root === this.root)!;

      this.viewport = new EditorScene(this.engine, composition, this.scene.renderSettings);
    }
  }

  owns (item: VFXItem): boolean {
    return this.scene.compositions.some(({ root }) => item === root || root.getDescendants().includes(item));
  }

  createControl (parent: VFXItem = this.root, kind: 'Control' | 'Label' = 'Label'): VFXItem {
    if (!this.owns(parent)) {throw new Error('Parent is outside the document.');}
    const item = new VFXItem(this.engine);

    item.name = kind;
    item.duration = parent.duration;
    item.endBehavior = parent.endBehavior;
    item.setParent(parent);
    item.addComponent(UIControl).control = kind === 'Label'
      ? new Label(this.engine, 'New label') : new Control(this.engine);
    item.getComponent(UIControl).control!.setSize(160, 40);
    item.initializeHierarchy();

    this.markModified();

    return item;
  }

  reparent (item: VFXItem, parent: VFXItem): void {
    if (!this.owns(item) || !this.owns(parent) || this.scene.compositions.some(entry => entry.root === item) ||
      item === parent || item.getDescendants().includes(parent)) {
      throw new Error('Invalid scene parent.');
    }
    if (item.parent === parent) {return;}
    item.setParent(parent);
    this.markModified();
  }

  remove (item: VFXItem): void {
    if (!this.owns(item) || this.scene.compositions.some(entry => entry.root === item)) {
      throw new Error('Cannot delete a composition root.');
    }
    item.dispose();
    this.markModified();
  }

  dispose (): void {
    for (const { root } of this.scene.compositions) {root.dispose();}
    this.viewport?.dispose();
    this.viewport = undefined;
    for (const { asset } of this.scene.assets ?? []) {
      this.engine.content.unloadAsset(asset);
      delete this.engine.jsonSceneData[asset.getInstanceId()];
    }
    this.scene.assets = [];
    for (const resource of this.resources) {
      resource.dispose();
      delete this.engine.jsonSceneData[resource.getInstanceId()];
    }
    this.resources = [];
    this.assetManager?.dispose();
    this.assetManager = undefined;
  }
}
