import type { EffectsObject, Engine, Texture } from '@galacean/effects';
import { Material, SerializationHelper, Shader, Sprite, SpriteComponent, spec } from '@galacean/effects';
import type { AssetEntry, AssetPayload } from '../model/asset-types';
import { isObjectAsset } from '../model/asset-types';
import { objectReferences, validateObjectAsset, validateObjectAssetReferences } from '../model/object-asset-data';

interface ObjectSource {
  projectId(): string,
  entry(id: string): AssetEntry | undefined,
  payload(id: string, projectId: string): Promise<AssetPayload | undefined>,
  loadTexture(engine: Engine, id: string): Promise<Texture>,
}

export class AssetObjectCache {
  private loaded = new WeakMap<Engine, Map<string, { version: number, object: EffectsObject }>>();
  private requests = new WeakMap<Engine, Map<string, Promise<EffectsObject>>>();
  private engines = new Set<WeakRef<Engine>>();

  constructor (private readonly source: ObjectSource) { }

  reset (): void { this.loaded = new WeakMap(); this.requests = new WeakMap(); this.engines.clear(); }

  get (engine: Engine, id: string): EffectsObject | undefined {
    const entry = this.source.entry(id), cached = this.loaded.get(engine)?.get(id);

    return cached?.version === entry?.updatedAt && cached?.object.isRegistered && engine.effectsObjectServer.objectInstance[id] === cached.object ? cached.object : undefined;
  }

  private trackEngine (engine: Engine): void {
    if (![...this.engines].some(reference => reference.deref() === engine)) { this.engines.add(new WeakRef(engine)); }
  }

  async refresh (entry: AssetEntry, currentEngine?: Engine): Promise<void> {
    if (currentEngine) { this.trackEngine(currentEngine); }
    await Promise.all([...this.engines].map(async reference => {
      const engine = reference.deref();

      if (!engine) {
        this.engines.delete(reference);

        return;
      }
      if (engine.effectsObjectServer.objectInstance[entry.id]?.isRegistered && !entry.deletedAt) { await this.load(engine, entry.id); }
    }));
  }

  load (engine: Engine, id: string, ancestors = new Set<string>()): Promise<EffectsObject> {
    if (ancestors.has(id)) { return Promise.reject(new Error('The asset references itself through another asset.')); }
    const cached = this.get(engine, id);

    if (cached) { return Promise.resolve(cached); }
    let requests = this.requests.get(engine);

    if (!requests) { requests = new Map(); this.requests.set(engine, requests); this.trackEngine(engine); }
    const pending = requests.get(id);

    if (pending) { return pending; }
    const projectId = this.source.projectId(), parents = new Set([...ancestors, id]);
    const task = (async () => {
      const entry = this.source.entry(id), payload = await this.source.payload(id, projectId);

      if (!entry || !payload || !isObjectAsset(payload)) { throw new Error('The asset definition is missing.'); }
      validateObjectAsset(payload);
      validateObjectAssetReferences(payload, id => this.source.entry(id));
      const data = structuredClone(payload.objects), owned = new Set(data.map(object => object.id));

      for (const dependency of objectReferences(data)) {
        if (owned.has(dependency)) { continue; }
        const target = this.source.entry(dependency);

        if (target?.kind === 'texture') { await this.source.loadTexture(engine, dependency); } else if (target && ['material', 'shader', 'sprite'].includes(target.kind)) { await this.load(engine, dependency, parents); }
      }
      if (projectId !== this.source.projectId()) { throw new Error('The asset belongs to a project that is no longer open.'); }
      if (entry.updatedAt !== this.source.entry(id)?.updatedAt) {
        requests.delete(id);

        return this.load(engine, id, ancestors);
      }
      data.forEach(object => engine.assetServer.addEffectsObjectData(object));
      const order = [...data].sort((a, b) => Number(a.dataType === spec.DataType.Material) - Number(b.dataType === spec.DataType.Material));

      for (const definition of order) {
        let object = engine.effectsObjectServer.objectInstance[definition.id];
        const previousTexture = object instanceof Sprite ? object.texture : undefined;

        if (definition.dataType === spec.DataType.Shader && object instanceof Shader) {
          const previous = object;

          previous.unregisterObject(); object = new Shader(engine); object.setInstanceId(definition.id);
          SerializationHelper.deserialize(definition, object);
          for (const candidate of Object.values(engine.effectsObjectServer.objectInstance)) {
            if (candidate instanceof Material && candidate.shader === previous) { candidate.shader = object as Shader; }
          }
        } else if (object?.isRegistered) { SerializationHelper.deserialize(definition, object); } else { object = engine.effectsObjectServer.findObject({ id: definition.id }); }
        if (!object) { throw new Error('The asset could not be loaded: ' + entry.name); }
        if (object instanceof Sprite) {
          for (const component of Object.values(engine.effectsObjectServer.objectInstance)) {
            if (component instanceof SpriteComponent && component.sprite === object) {
              const textures = component.materials.map(material => material.getTexture('_MainTex'));

              component.sprite = object;
              if (previousTexture === object.texture) {
                component.materials.forEach((material, index) => {
                  const texture = textures[index];

                  if (texture) { material.setTexture('_MainTex', texture); }
                });
              }
            }
          }
        }
      }
      const object = engine.effectsObjectServer.objectInstance[id];

      if (!object) { throw new Error('The asset could not be loaded: ' + entry.name); }
      object.definition.name = entry.name; Reflect.set(object, 'name', entry.name);
      let loaded = this.loaded.get(engine);

      if (!loaded) { loaded = new Map(); this.loaded.set(engine, loaded); }
      loaded.set(id, { version: entry.updatedAt, object });

      return object;
    })().finally(() => requests.delete(id));

    requests.set(id, task);

    return task;
  }
}
