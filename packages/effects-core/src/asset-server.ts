import * as spec from '@galacean/effects-specification';
import { EngineServer } from './engine-server';
import { effectsClass, getClass } from './decorators';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import type { EffectsObject } from './effects-object';
import { Asset } from './asset';
import { Material } from './material';
import { AssetManager } from './asset-manager';
import { EffectsPackage } from './effects-package';
import { SerializationHelper } from './serialization-helper';
import { generateEmptyTexture, generateWhiteTexture, Texture } from './texture';
import type { AbstractConstructor, Constructor } from './utils';

export class Database {
  async loadGUID (guid: string): Promise<EffectsObject | undefined> {
    return undefined;
  }
}

/** Engine-owned asset preparation and built-in resource lifecycle. */
@effectsClass('AssetServer')
export class AssetServer extends EngineServer {
  whiteTexture: Texture;
  transparentTexture: Texture;
  /** Object definitions keyed by their serialized IDs. */
  objectsDataCache: Record<string, spec.EffectsObjectData> = {};
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  private readonly _assetManagers: AssetManager[] = [];
  private readonly builtinObjects = new Map<string, EffectsObject>();

  constructor (engine: Engine) {
    super(engine, -600);
  }

  override onInit (): void {
    const { engine } = this;

    this.whiteTexture = generateWhiteTexture(engine);
    this.transparentTexture = generateEmptyTexture(engine);
    this.builtinObjects.set(spec.BuiltinObjectGUID.WhiteTexture, this.whiteTexture);
    this.builtinObjects.set(spec.BuiltinObjectGUID.EmptyTexture, this.transparentTexture);
  }

  get assetManagers (): readonly AssetManager[] {
    return this._assetManagers;
  }

  /** @internal Reset definitions before registering another asset package. */
  clearEffectsObjectData (): void {
    this.objectsDataCache = {};
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.objectsDataCache[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.objectsDataCache[uuid];
  }

  loadGUID<T> (dataPath: spec.DataPath, type?: AbstractConstructor): T {
    if (!dataPath) {
      return null as T;
    }

    const id = String(dataPath.id);
    const builtin = this.builtinObjects.get(id);

    if (builtin) {
      return builtin as T;
    }
    const data = this.findEffectsObjectData(id);

    if (!data) {
      console.warn(`Object data with uuid: ${id} not found.`);

      return undefined as T;
    }

    const objectClass: Constructor<Asset> | undefined = getClass(data.dataType);

    if (!objectClass) {
      console.warn(`Constructor for DataType: ${data.dataType} not found.`);

      return undefined as T;
    }
    const isAsset = objectClass === Asset || objectClass.prototype instanceof Asset;

    if (!isAsset || (type && objectClass !== type && !(objectClass.prototype instanceof type))) {
      return undefined as T;
    }

    const instance = new objectClass(this.engine);
    const context = this.engine.effectsObjectServer.deserializationContext;

    // References read in fromData can already resolve this instance.
    context?.idsMapping.set(id, instance.getInstanceId());
    context?.sceneAssets.add(instance);
    SerializationHelper.deserialize({ ...data }, instance);

    return instance as T;
  }

  createAssetManager (options: SceneLoadOptions): AssetManager {
    const manager = new AssetManager(options);

    this._assetManagers.push(manager);

    return manager;
  }

  /** Release the current batch of load sessions before starting another one. */
  releaseAssetManagers (): void {
    for (const manager of this._assetManagers.splice(0)) {
      manager.dispose();
    }
  }

  /** Register the scene definitions and loaded assets together. */
  prepareAssets (scene: Scene): void {
    const { jsonScene, assets, bins, textureOptions = [] } = scene;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins: binaryDatas = [], miscs = [], compositions,
    } = jsonScene;

    for (const compositionData of compositions) {
      this.addEffectsObjectData(compositionData as unknown as spec.EffectsObjectData);
    }
    for (const vfxItemData of items) {
      this.addEffectsObjectData(vfxItemData);
    }
    for (const materialData of materials) {
      this.addEffectsObjectData(materialData);
    }
    for (const shaderData of shaders) {
      this.addEffectsObjectData(shaderData);
    }
    for (const geometryData of geometries) {
      this.addEffectsObjectData(geometryData);
    }
    for (const componentData of components) {
      this.addEffectsObjectData(componentData);
    }
    for (const animationData of animations) {
      this.addEffectsObjectData(animationData);
    }
    for (const miscData of miscs) {
      this.addEffectsObjectData(miscData);
    }
    for (let i = 0; i < binaryDatas.length; i++) {
      const binaryData = binaryDatas[i];
      const binaryBuffer = bins[i];

      if (binaryData.dataType === spec.DataType.BinaryAsset) {
        //@ts-expect-error
        binaryData.buffer = binaryBuffer;
        if (binaryData.id) {
          this.addEffectsObjectData(binaryData);
        }
      } else {
        const effectsPackage = new EffectsPackage();

        effectsPackage.deserializeFromBinary(new Uint8Array(binaryBuffer));
        for (const effectsObjectData of effectsPackage.exportObjectDatas) {
          this.addEffectsObjectData(effectsObjectData);
        }
      }
    }
    for (const textureData of textureOptions) {
      if (!(textureData instanceof Texture)) {
        this.addEffectsObjectData(textureData as spec.EffectsObjectData);
      }
    }
    for (const id of Object.keys(assets)) {
      const input = { id, dataType: 'DataAsset' as spec.DataType, data: assets[id] };

      this.addEffectsObjectData(input);
    }
  }

  // TODO Material 单独存表, 加速查询
  createShaderVariant () {
    for (const guid of Object.keys(this.engine.effectsObjectServer.objectsCache)) {
      const effectsObject = this.engine.effectsObjectServer.objectsCache[guid];

      if (effectsObject instanceof Material && effectsObject.shader) {
        effectsObject.createShaderVariant();
      }
    }
  }

  override onDispose (): void {
    this.releaseAssetManagers();
    this.builtinObjects.forEach(object => object.dispose());
    this.builtinObjects.clear();
  }
}
