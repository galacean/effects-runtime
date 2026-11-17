import type * as spec from '@galacean/effects-specification';
import { Asset } from './asset';
import { effectsClass } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import type { Material } from './material';
import type { Geometry } from './render/geometry';
import { SerializationHelper } from './serialization-helper';
import type { Texture } from './texture';
import type { AbstractConstructor, RestoreHandler } from './utils';
import { addItem, isPlainObject, logger, removeItem } from './utils';
import type { VFXItem } from './vfx-item';

/** @internal The root and ID mapping for one hierarchy being deserialized. */
export interface DeserializationContext {
  root: VFXItem,
  idsMapping: Map<string, string>,
}

/** Owns live resource tracking and the separate serialized object lookup context. */
@effectsClass('EffectsObjectServer')
export class EffectsObjectServer extends EngineServer {
  objectInstance: Record<string, EffectsObject> = {};

  private _deserializationContext?: DeserializationContext;

  // These lists survive lookup resets and track resources until their owners dispose them.
  private textures: Texture[] = [];
  private materials: Material[] = [];
  private geometries: Geometry[] = [];

  constructor (engine: Engine) {
    // Dispose after rendering services and before the graphics device.
    super(engine, -950);
  }

  addTexture (tex: Texture) {
    if (this.engine.disposed) {
      return;
    }
    addItem(this.textures, tex);
  }

  removeTexture (tex: Texture) {
    removeItem(this.textures, tex);
  }

  addMaterial (mat: Material) {
    if (this.engine.disposed) {
      return;
    }
    addItem(this.materials, mat);
  }

  removeMaterial (mat: Material) {
    removeItem(this.materials, mat);
  }

  addGeometry (geo: Geometry) {
    if (this.engine.disposed) {
      return;
    }
    addItem(this.geometries, geo);
  }

  removeGeometry (geo: Geometry) {
    removeItem(this.geometries, geo);
  }

  /** @internal Rebuild engine-owned resources after the device restores shaders. */
  restoreGraphicsResources (): void {
    this.geometries.forEach(geo => geo.restore());
    this.textures.forEach(resource => (resource as unknown as RestoreHandler).restore());
  }

  override onDispose (): void {
    // Release remaining engine-owned resources while the device is still alive.
    const info: string[] = [];

    if (this.geometries.length > 0) {
      info.push(`Geom ${this.geometries.length}`);
    }
    if (this.textures.length > 0) {
      info.push(`Tex ${this.textures.length}`);
    }

    if (info.length > 0) {
      logger.warn(`Release GPU memory: ${info.join(', ')}.`);
    }

    this.geometries.slice().forEach(geo => geo.dispose());
    this.materials.slice().forEach(mat => mat.dispose());
    this.textures.slice().forEach(tex => tex.dispose());

    this.textures = [];
    this.materials = [];
    this.geometries = [];

    for (const id of Object.keys(this.objectInstance)) {
      this.objectInstance[id].unregisterObject();
    }
    this.objectInstance = {};
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  registerObject (object: EffectsObject): void {
    this.objectInstance[object.getInstanceId()] = object;
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  unregisterObject (object: EffectsObject): void {
    delete this.objectInstance[object.getInstanceId()];
    this.engine.assetServer.removeAsset(object);
  }

  /** Reset the current lookup context without disposing the objects or GPU resources. */
  clearObjectInstances (): void {
    for (const id of Object.keys(this.objectInstance)) {
      this.objectInstance[id].unregisterObject();
    }
    this.objectInstance = {};
  }

  /** @internal */
  get deserializationContext (): DeserializationContext | undefined {
    return this._deserializationContext;
  }

  /** @internal */
  withDeserializationContext (context: DeserializationContext, deserialize: () => void): void {
    const previousContext = this._deserializationContext;

    this._deserializationContext = context;
    try {
      deserialize();
    } finally {
      this._deserializationContext = previousContext;
    }
  }

  findObject<T> (dataPath: spec.DataPath, type?: AbstractConstructor<T>): T {
    // The editor may pass the object directly.
    let object: unknown = dataPath;

    if (isPlainObject(dataPath)) {
      const { id } = dataPath;
      const idsMapping = this._deserializationContext?.idsMapping;
      const instanceId = idsMapping?.get(String(id)) ?? id;

      object = this.objectInstance[instanceId];
      if (!object && (
        !type ||
        type.prototype === EffectsObject.prototype ||
        type.prototype === Asset.prototype ||
        type.prototype instanceof Asset
      )) {
        const { assetServer } = this.engine;

        if (!idsMapping) {
          object = assetServer.loadGUID(dataPath, type);
        } else {
          const asset = assetServer.findAsset(id);

          if (asset && !asset.isSceneLocal) {
            object = asset;
          } else {
            const created = assetServer.assetLoader.createObject(id, type);

            if (!created) {
              return undefined as T;
            }
            const { data, instance } = created;
            const { isSceneLocal } = instance;

            if (isSceneLocal) {
              idsMapping.set(String(id), instance.getInstanceId());
            } else {
              assetServer.addAsset(id, instance);
            }
            SerializationHelper.deserialize(isSceneLocal ? { ...data } : data, instance);
            object = instance;
          }
        }
      }
    }

    return (!type || object instanceof type ? object : undefined) as T;
  }
}
