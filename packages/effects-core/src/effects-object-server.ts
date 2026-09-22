import type * as spec from '@galacean/effects-specification';
import { effectsClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import type { Material } from './material';
import type { Geometry } from './render/geometry';
import type { ParticleSystem } from './plugins/particle/particle-system';
import type { Texture } from './texture';
import type { RestoreHandler } from './utils';
import { addItem, isPlainObject, logger, removeItem } from './utils';

/** Owns live resource tracking and the separate serialized object lookup context. */
@effectsClass('EffectsObjectServer')
export class EffectsObjectServer extends EngineServer {
  objectInstance: Record<string, EffectsObject> = {};

  // These lists survive lookup resets and track resources until their owners dispose them.
  private textures: Texture[] = [];
  private materials: Material[] = [];
  private geometries: Geometry[] = [];
  private particleSystems: ParticleSystem[] = [];

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

  /** @internal */
  addParticleSystem (particleSystem: ParticleSystem): void {
    if (this.engine.disposed) {
      return;
    }
    addItem(this.particleSystems, particleSystem);
  }

  /** @internal */
  removeParticleSystem (particleSystem: ParticleSystem): void {
    removeItem(this.particleSystems, particleSystem);
  }

  /** @internal Rebuild engine-owned resources after the device restores shaders. */
  restoreGraphicsResources (): void {
    this.geometries.forEach(geo => geo.restore());
    this.particleSystems.forEach(system => system.rebuild());
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
    this.particleSystems = [];

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
  }

  /** Reset the current lookup context without disposing the objects or GPU resources. */
  clearObjectInstances (): void {
    for (const id of Object.keys(this.objectInstance)) {
      this.objectInstance[id].unregisterObject();
    }
    this.objectInstance = {};
  }

  findObject<T> (guid: spec.DataPath): T {
    // 编辑器可能传 Class 对象，这边判断处理一下直接返回原对象。
    if (!isPlainObject(guid)) {
      return guid as T;
    }

    if (this.objectInstance[guid.id]) {
      return this.objectInstance[guid.id] as T;
    }

    return this.engine.assetServer.loadGUID<T>(guid);
  }
}
