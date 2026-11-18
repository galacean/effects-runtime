import type * as spec from '@galacean/effects-specification';
import { Asset } from './asset';
import { effectsClass } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import type { Material } from './material';
import type { Geometry } from './render/geometry';
import type { Texture } from './texture';
import type { AbstractConstructor, RestoreHandler } from './utils';
import { addItem, isPlainObject, logger, removeItem } from './utils';
import type { VFXItem } from './vfx-item';

/** @internal Object lookup and asset ownership while instantiating a hierarchy. */
export interface DeserializationContext {
  root: VFXItem,
  idsMapping: Map<string, string>,
  sceneAssets: Set<Asset>,
}

/** Owns live resource tracking and the separate serialized object lookup context. */
@effectsClass('EffectsObjectServer')
export class EffectsObjectServer extends EngineServer {
  objectsCache: Record<string, EffectsObject> = {};

  private _deserializationContext?: DeserializationContext;

  // Track GPU resources until their owners dispose them.
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

    for (const id of Object.keys(this.objectsCache)) {
      this.objectsCache[id].unregisterObject();
    }
    this.objectsCache = {};
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  registerObject (object: EffectsObject): void {
    this.objectsCache[object.getInstanceId()] = object;
  }

  /** @internal Called by EffectsObject to keep its registration state in sync. */
  unregisterObject (object: EffectsObject): void {
    delete this.objectsCache[object.getInstanceId()];
  }

  /** @internal */
  get deserializationContext (): DeserializationContext | undefined {
    return this._deserializationContext;
  }

  /** @internal */
  withDeserializationContext<T> (context: DeserializationContext, deserialize: () => T): T {
    const previousContext = this._deserializationContext;

    this._deserializationContext = context;
    const result = deserialize();

    this._deserializationContext = previousContext;

    return result;
  }

  findObject<T> (dataPath: spec.DataPath, type?: AbstractConstructor<T>): T {
    // The editor may pass the object directly.
    if (!isPlainObject(dataPath)) {
      return (!type || dataPath instanceof type ? dataPath : undefined) as T;
    }

    const id = String(dataPath.id);
    const instanceId = this._deserializationContext?.idsMapping.get(id) ?? id;
    const object = this.objectsCache[instanceId];

    if (object) {
      return (!type || object instanceof type ? object : undefined) as T;
    }

    const { assetServer } = this.engine;

    if (!type) {
      return assetServer.loadGUID<T>(dataPath);
    }
    const prototype = type.prototype;

    if (prototype === EffectsObject.prototype || prototype === Asset.prototype || prototype instanceof Asset) {
      const asset = assetServer.loadGUID<T>(dataPath, type);

      if (asset instanceof type) {
        return asset;
      }
    }

    return undefined as T;
  }
}
