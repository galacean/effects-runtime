import { Asset, AssetManager, getClass, PluginSystem, spec } from '@galacean/effects';
import type { Engine, BinaryAsset } from '@galacean/effects';
import { EditorContent } from '../content';
import { SceneResources } from './scene-resources';
import { sceneAssetCollections } from './scene-graph';
import type { SceneAssetCollection, EmbeddedSceneAsset } from './scene-graph';

/** Loads and owns resources before the serializer allocates the complete scene graph. */
export class SceneLoader {
  static async load (engine: Engine, data: spec.JSONScene | string) {
    const manager = new AssetManager();
    const resources = new SceneResources();
    const assets: EmbeddedSceneAsset[] = [];
    let records: { collection: SceneAssetCollection, record: spec.EffectsObjectData }[] = [];

    resources.disposables.push(manager);
    try {
      const loaded = await manager.loadScene(typeof data === 'string' ? data : structuredClone(data), engine.renderer);
      const normalized = loaded.jsonScene;

      resources.fromData(normalized, typeof data === 'string' ? new URL(data, location.href).href : location.href);
      PluginSystem.notifyAssetsLoadFinish(loaded, manager.options, engine);
      const previousRecords = new Map(Object.entries(engine.jsonSceneData));

      for (const [index, file] of (normalized.bins ?? []).entries()) {
        if (file.dataType !== spec.DataType.BinaryAsset) {resources.bindPackage(index, loaded.bins[index]);}
      }
      engine.assetService.prepareAssets(loaded, loaded.assets);
      records = sceneAssetCollections.flatMap(collection => (normalized[collection] ?? []).map(record => {
        if (!record.id) {throw new Error('Embedded scene assets require an ID.');}

        return { collection, record: engine.jsonSceneData[record.id] ?? record };
      }));
      // Several legacy scenes repeat the same texture identity in their arrays.
      // The registry's final definition is authoritative and each asset is loaded once.
      records = Array.from(new Map(records.map(entry => [entry.record.id, entry])).values());
      const listedIds = new Set(records.map(({ record }) => record.id));
      const collections: Partial<Record<spec.DataType, SceneAssetCollection>> = {
        [spec.DataType.Geometry]: 'geometries', [spec.DataType.Material]: 'materials',
        [spec.DataType.Shader]: 'shaders', [spec.DataType.Texture]: 'textures',
        [spec.DataType.AnimationClip]: 'animations', [spec.DataType.AnimationGraphAsset]: 'animations',
      };

      for (const record of Object.values(engine.jsonSceneData)) {
        if (listedIds.has(record.id) || previousRecords.get(record.id) === record) {continue;}
        const Type = getClass(record.dataType);

        if (!Type || !(Type.prototype instanceof Asset)) {continue;}
        // Binary assets remain resources referenced by GUID; package-exported assets
        // are first-class scene assets and are repackaged from their live objects.
        if (record.dataType === spec.DataType.BinaryAsset) {
          const asset = await engine.content.load(record.id);

          if (!asset) {throw new Error(`Failed to load binary asset '${record.id}'.`);}
          resources.bindBinary(asset as BinaryAsset);
        } else {
          records.push({ collection: collections[record.dataType] ?? 'miscs', record });
        }
      }
      for (const id of Object.keys(loaded.assets)) {
        const object = engine.objectInstance[id];

        if (object) {resources.objects.push(object);}
      }
      for (const { record } of records) {
        const existing = engine.content.getAsset(record.id);

        if (existing) {engine.content.unloadAsset(existing);}
        engine.addEffectsObjectData(record);
      }
      for (const { collection, record } of records) {
        const asset = await engine.content.load(record.id);

        if (!asset) {throw new Error(`Failed to load embedded scene asset '${record.id}'.`);}
        if (collection === 'textures') {
          // GPU upload sources are runtime state. The texture owns its authored
          // image/mipmap reference, while toData writes current sampler settings.
          asset.definition = structuredClone(normalized.textures!.find(texture => texture.id === record.id)!);
        }
        assets.push({ asset, collection });
      }
      if (engine.content instanceof EditorContent) {await engine.content.loadSceneAssets(normalized);}
      const tree = { ...normalized, images: [], bins: [] };

      for (const collection of sceneAssetCollections) {tree[collection] = [];}

      return { data: tree, assets, resources };
    } catch (error) {
      for (const { record } of records) {
        const asset = engine.content.getAsset(record.id);

        if (asset) {engine.content.unloadAsset(asset);}
        delete engine.jsonSceneData[record.id];
      }
      resources.dispose();
      throw error;
    }
  }
}
