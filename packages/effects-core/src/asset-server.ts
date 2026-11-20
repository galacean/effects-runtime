import * as spec from '@galacean/effects-specification';
import { EngineServer } from './engine-server';
import { effectsClass, getClass } from './decorators';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import type { EffectsObject } from './effects-object';
import { Asset } from './asset';
import { Material } from './material';
import { AssetManager } from './asset-manager';
import { SerializationHelper } from './serialization-helper';
import type { Texture } from './texture';
import { generateEmptyTexture, generateWhiteTexture } from './texture';
import type { AbstractConstructor, Constructor } from './utils';

/** Editor-provided definitions that are ready for synchronous deserialization. */
export abstract class Database {
  abstract findEffectsObjectData (uuid: string): spec.EffectsObjectData | undefined;
}

/** Engine-owned asset instantiation and built-in resource lifecycle. */
@effectsClass('AssetServer')
export class AssetServer extends EngineServer {
  whiteTexture: Texture;
  transparentTexture: Texture;
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

  findEffectsObjectData (uuid: string, scene?: Scene) {
    return scene?.objectsDataCache?.get(uuid) ?? this.database?.findEffectsObjectData(uuid);
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
    const context = this.engine.effectsObjectServer.deserializationContext;
    const data = this.findEffectsObjectData(id, context?.scene);

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
