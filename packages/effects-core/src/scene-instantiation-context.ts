import type * as spec from '@galacean/effects-specification';
import type { Asset } from './asset';
import type { EffectsObject } from './effects-object';
import type { DeserializationContext } from './effects-object-server';
import type { Scene } from './scene';
import type { VFXItem } from './vfx-item';

/** @internal Tracks scene objects and selects their deserialization contexts. */
export class SceneInstantiationContext {
  private readonly deserializationContexts: DeserializationContext[] = [];
  private readonly contextIndexByObjectId = new Map<string, number>();
  private readonly sceneObjects: EffectsObject[] = [];
  private currentContextIndex = 0;

  constructor (readonly root: VFXItem, readonly scene?: Scene) {
    this.deserializationContexts.push(this.createDeserializationContext(root));
    this.contextIndexByObjectId.set(root.getInstanceId(), this.currentContextIndex);
  }

  get objects (): readonly EffectsObject[] {
    return this.sceneObjects;
  }

  addObject (object: EffectsObject, data: spec.EffectsObjectData): void {
    object.definition = { ...data };
    this.bindId(data.id, object);
    this.contextIndexByObjectId.set(object.getInstanceId(), this.currentContextIndex);
    this.sceneObjects.push(object);
  }

  bindId (id: string, object: EffectsObject): void {
    this.deserializationContexts[this.currentContextIndex].idsMapping.set(id, object.getInstanceId());
  }

  hasId (id: string): boolean {
    return this.deserializationContexts[this.currentContextIndex].idsMapping.has(id);
  }

  findData (id: string): spec.EffectsObjectData | undefined {
    return this.scene?.objectsDataCache?.get(id) ?? this.root.engine.assetServer.database?.findEffectsObjectData(id);
  }

  selectDeserializationContext (object: EffectsObject): DeserializationContext {
    const index = this.contextIndexByObjectId.get(object.getInstanceId());

    if (index === undefined) {
      throw new Error(`Object ${object.getInstanceId()} does not belong to this instantiation context.`);
    }
    this.currentContextIndex = index;

    return this.deserializationContexts[index];
  }

  withNewContext<T> (root: VFXItem, spawn: () => T): T {
    const previousContextIndex = this.currentContextIndex;

    this.currentContextIndex = this.deserializationContexts.length;
    this.deserializationContexts.push(this.createDeserializationContext(root));
    const result = spawn();

    this.currentContextIndex = previousContextIndex;

    return result;
  }

  withSceneData<T> (load: () => T): T {
    return this.root.engine.assetServer.withSceneData(this.scene?.objectsDataCache, load);
  }

  registerSceneAssets (assetRoot?: VFXItem): void {
    const root = assetRoot ?? this.root;

    for (let index = 0; index < this.deserializationContexts.length; index++) {
      const context = this.deserializationContexts[index];
      const owner = index === 0 ? root : context.root;

      owner.addSceneAssets(context.sceneAssets);
    }
  }

  private createDeserializationContext (root: VFXItem): DeserializationContext {
    return { root, idsMapping: new Map(), sceneAssets: new Set<Asset>() };
  }
}
