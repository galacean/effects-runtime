import type { Asset, Constructor, EffectsObject, Engine } from '@galacean/effects';
import {
  Content, SerializationHelper, base64ToFile, getEffectsClassName, loadImage, spec,
} from '@galacean/effects';
import { AssetsCache, type EditorAssetInfo } from './assets-cache';
import { ContentDatabase } from './content-database';
import {
  isJsonAssetFile, jsonAssetReplacer, serializeJsonAsset,
} from './json-asset-file';

export class EditorContent extends Content {
  readonly assetsCache: AssetsCache;
  readonly contentDatabase: ContentDatabase;

  private readonly dependencies = new Map<string, Set<string>>();
  private readonly dirtyAssets = new Set<string>();

  constructor (
    engine: Engine,
    assetsCache = new AssetsCache(),
    contentDatabase = new ContentDatabase(assetsCache),
  ) {
    super(engine);
    this.assetsCache = assetsCache;
    this.contentDatabase = contentDatabase;
  }

  async setProjectRoot (rootDirectoryHandle: FileSystemDirectoryHandle): Promise<void> {
    await this.contentDatabase.initialize(rootDirectoryHandle);
  }

  override loadAsync<T extends Asset> (idOrPath: string, expectedType?: Constructor<T>): T | undefined {
    const info = this.assetsCache.getAssetInfo(idOrPath);
    const id = info?.id ?? idOrPath;
    const loaded = this.getAsset<T>(id);

    if (loaded) {
      return super.loadAsync(id, expectedType);
    }

    // The editor asset index is authoritative for indexed GUIDs. The Engine
    // may still contain embedded data from the previously played scene; using
    // that stale data here can resurrect resources disposed with the previous
    // Composition and makes the next scene open render black.
    if (!info) {
      return super.loadAsync(id, expectedType);
    }

    const asset = this.createAssetPlaceholder(id, info.typeName, expectedType);

    if (!asset) {
      return undefined;
    }

    this.startFileLoad(asset, info);

    return asset;
  }

  getAssetInfo (idOrPath: string): EditorAssetInfo | undefined {
    return this.assetsCache.getAssetInfo(idOrPath);
  }

  async reloadAsset<T extends Asset> (asset: T): Promise<T | undefined> {
    const info = this.getAssetInfo(asset.getInstanceId());

    if (!info) {
      return undefined;
    }

    // Flax Reload() waits for the current load to end before starting another
    // one. Looping preserves that ordering when several async reload calls are
    // issued concurrently in JavaScript.
    while (!asset.isLoaded && !asset.isLoadFailed) {
      try {
        await asset.waitForLoaded();
      } catch {
        // A failed load can still be retried explicitly.
      }
      if (this.getAsset(info.id) !== asset) {
        return undefined;
      }
    }
    if (this.getAsset(info.id) !== asset) {
      return undefined;
    }

    this.startFileLoad(asset, info);

    try {
      await asset.waitForLoaded();

      return asset;
    } catch {
      return undefined;
    }
  }

  async loadGraph<T extends Asset> (idOrPath: string, expectedType?: Constructor<T>): Promise<T | undefined> {
    const root = await this.load(idOrPath, expectedType);

    if (!root) {
      return undefined;
    }

    const pending = [root.getInstanceId()];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const id = pending.pop()!;

      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      const asset = await this.load(id);

      if (!asset) {
        return undefined;
      }

      for (const dependency of this.dependencies.get(id) ?? []) {
        pending.push(dependency);
      }
    }

    return root;
  }

  async loadSceneAssets (scene: spec.JSONScene): Promise<void> {
    for (const id of this.collectDependencies(scene, '')) {
      if (!await this.loadGraph(id)) {
        throw new Error(`Failed to load scene asset '${id}'.`);
      }
    }
  }

  getDependencies (id: string): readonly string[] {
    return Array.from(this.dependencies.get(id) ?? []);
  }

  setDirty (assetOrId: Asset | string): void {
    this.dirtyAssets.add(typeof assetOrId === 'string' ? assetOrId : assetOrId.getInstanceId());
  }

  async saveAssets (): Promise<void> {
    for (const id of this.dirtyAssets) {
      const asset = this.getAsset(id);

      if (asset) {
        await this.saveAsset(asset);
      }
    }
    this.dirtyAssets.clear();
    await this.assetsCache.save();
  }

  async saveAsset (asset: Asset, path?: string): Promise<void> {
    const existing = this.getAssetInfo(asset.getInstanceId());
    const targetPath = path ?? existing?.path;
    const typeName = existing?.typeName ?? getEffectsClassName(asset.constructor as Constructor<EffectsObject>);

    if (!targetPath || !typeName) {
      throw new Error(`Cannot save asset '${asset.getInstanceId()}' without a path and registered TypeName.`);
    }

    const fileHandle = await this.contentDatabase.getFileHandle(targetPath, true);

    if (!fileHandle) {
      throw new Error(`Cannot open JsonAsset '${targetPath}'.`);
    }

    const writable = await fileHandle.createWritable();
    const jsonAsset = serializeJsonAsset(asset, typeName);

    await writable.write(JSON.stringify(jsonAsset, jsonAssetReplacer, 2));
    await writable.close();

    const file = await fileHandle.getFile();

    this.contentDatabase.registerAsset({
      id: asset.getInstanceId(),
      typeName,
      path: targetPath,
      lastModified: file.lastModified,
    }, fileHandle);
    await this.assetsCache.save();
  }

  private startFileLoad (asset: Asset, info: EditorAssetInfo): void {
    asset.startLoading(task => this.loadJsonAsset(asset, info, task));
  }

  private async loadJsonAsset (
    asset: Asset,
    info: EditorAssetInfo,
    task: { readonly isCancelRequested: boolean },
  ): Promise<void> {
    const handle = await this.contentDatabase.getFileHandle(info.path);

    if (!handle) {
      throw new Error(`JsonAsset file '${info.path}' does not exist.`);
    }
    if (task.isCancelRequested) {
      return;
    }

    const file = await handle.getFile();

    if (task.isCancelRequested) {
      return;
    }

    const json = JSON.parse(await file.text()) as unknown;

    if (!isJsonAssetFile(json)) {
      throw new Error(`File '${info.path}' is not a valid JsonAsset.`);
    }
    if (json.ID !== info.id || json.TypeName !== info.typeName) {
      throw new Error(`JsonAsset header for '${info.path}' does not match the editor asset index.`);
    }

    const data = {
      ...json.Data,
      id: json.ID,
      dataType: json.TypeName,
    } as spec.EffectsObjectData;

    await this.prepareData(data);

    if (task.isCancelRequested) {
      return;
    }

    const dependencies = this.collectDependencies(json.Data, json.ID);

    this.dependencies.set(json.ID, dependencies);
    // Create all dependency placeholders before fromData resolves fields.
    for (const dependency of dependencies) {
      this.loadAsync(dependency);
    }

    SerializationHelper.deserialize(data, asset);
  }

  private collectDependencies (value: unknown, ownerId: string, result = new Set<string>()): Set<string> {
    if (!value || typeof value !== 'object') {
      return result;
    }
    if (SerializationHelper.checkDataPath(value)) {
      if (value.id !== ownerId && this.assetsCache.getAssetInfo(value.id)) {
        result.add(value.id);
      }

      return result;
    }
    if (Array.isArray(value)) {
      value.forEach(item => this.collectDependencies(item, ownerId, result));

      return result;
    }

    Object.values(value).forEach(item => this.collectDependencies(item, ownerId, result));

    return result;
  }

  private async prepareData (data: spec.EffectsObjectData): Promise<void> {
    if (data.dataType !== spec.DataType.Texture) {
      return;
    }

    const textureData = data as spec.EffectsObjectData & {
      source?: string,
      image?: HTMLCanvasElement,
    };

    if (typeof textureData.source === 'string') {
      const image = await loadImage(
        textureData.source.startsWith('data:')
          ? textureData.source
          : base64ToFile(textureData.source),
      );
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      if (!context) {
        throw new Error(`Cannot create a 2D context for texture '${data.id}'.`);
      }
      context.drawImage(image, 0, 0);
      // Some WebGL implementations reject decoded blob/data-url image
      // elements in texImage2D even though their dimensions are valid. A
      // same-origin canvas is a stable upload source in both the editor and
      // the browser test environment.
      textureData.image = canvas;
    }
  }
}
