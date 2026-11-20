import type * as spec from '@galacean/effects-specification';
import type { Asset } from './asset';
import { getClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { DeserializationContext } from './effects-object-server';
import type { Engine } from './engine';
import type { Scene } from './scene';
import { Texture } from './texture';
import { VFXItem } from './vfx-item';

/** @internal Creates hierarchy objects before deserializing their references. */
export class SceneObjectsFactory {
  private readonly objects = new Map<EffectsObject, DeserializationContext>();
  private readonly suppliedTextures: readonly Texture[];

  private constructor (private readonly engine: Engine, private readonly scene?: Scene) {
    this.suppliedTextures = scene?.textureOptions?.filter((texture): texture is Texture => texture instanceof Texture) ?? [];
  }

  static instantiateComposition (
    data: spec.CompositionData,
    root: VFXItem,
    scene?: Scene,
  ): void {
    const { engine } = root;

    engine.assetServer.withSceneData(scene?.objectsDataCache, () => {
      const factory = new SceneObjectsFactory(engine, scene);

      root.name = data.name;
      root.duration = data.duration;
      root.endBehavior = data.endBehavior;
      const context = factory.spawnComposition(data, root);

      factory.finish(context);
    });
  }

  static instantiateItem (data: spec.VFXItemData, engine: Engine, assetRoot?: VFXItem, scene = assetRoot?.sourceScene): VFXItem {
    return engine.assetServer.withSceneData(scene?.objectsDataCache, () => {
      const item = new VFXItem(engine);
      const factory = new SceneObjectsFactory(engine, scene);
      const context = factory.createContext(item);

      factory.spawnItem(data, item, context);
      factory.finish(context, assetRoot);

      return item;
    });
  }

  private spawnComposition (data: spec.CompositionData, item: VFXItem) {
    const context = this.createContext(item);

    item.sourceScene = this.scene;
    context.idsMapping.set(String(data.id), item.getInstanceId());
    // The composition and its placement can both refer to the same root.
    if (item.definition.id !== undefined) {
      context.idsMapping.set(String(item.definition.id), item.getInstanceId());
    }
    this.spawnContents(data, context);

    return context;
  }

  private spawnItem (
    data: spec.VFXItemData,
    item: VFXItem,
    context: DeserializationContext,
  ): void {
    item.sourceScene = this.scene;
    context.idsMapping.set(String(data.id), item.getInstanceId());
    item.definition = { ...data };
    this.objects.set(item, context);

    const { refId } = data as { refId?: string };
    let template: spec.CompositionData | undefined;

    if (refId !== undefined) {
      template = this.engine.assetServer.findEffectsObjectData(refId) as unknown as spec.CompositionData | undefined;
      if (!template) {
        throw new Error(`Referenced precomposition with Id: ${refId} does not exist.`);
      }
      this.spawnComposition(template, item);
    }
    this.spawnContents(data, context, template?.components);
  }

  private finish (outerContext: DeserializationContext, assetRoot = outerContext.root): void {
    this.deserialize();
    const contexts = new Set(this.objects.values());

    contexts.add(outerContext);

    for (const context of contexts) {
      const root = context === outerContext ? assetRoot : context.root;

      root.addSceneAssets(context.sceneAssets);
    }
  }

  private deserialize (): void {
    const objectServer = this.engine.effectsObjectServer;

    for (const [object, context] of this.objects) {
      objectServer.withDeserializationContext(context, () => {
        object.fromData(object.definition as spec.EffectsObjectData);
      });
    }
  }

  private createContext (root: VFXItem): DeserializationContext {
    const idsMapping = new Map(this.suppliedTextures.map(texture => [texture.id, texture.getInstanceId()]));

    return { root, idsMapping, sceneAssets: new Set<Asset>() };
  }

  private spawnContents (
    data: Pick<spec.CompositionData, 'components' | 'children'>,
    context: DeserializationContext,
    templateComponents?: spec.DataPath[],
  ): void {
    for (const path of data.components ?? []) {
      if (!templateComponents?.some(component => component.id === path.id)) {
        this.spawn(path, context);
      }
    }
    for (const path of data.children ?? []) {
      this.spawn(path, context);
    }
  }

  private spawn ({ id }: spec.DataPath, context: DeserializationContext): void {
    const { idsMapping } = context;

    if (idsMapping.has(String(id))) {
      return;
    }
    const entry = this.engine.assetServer.findEffectsObjectData(id);

    if (!entry) {
      return;
    }
    const Constructor = getClass(entry.dataType);

    if (!Constructor) {
      console.warn(`Constructor for DataType: ${entry.dataType} not found.`);

      return;
    }
    const object: EffectsObject = new Constructor(this.engine);

    if (object instanceof VFXItem) {
      this.spawnItem(entry as spec.VFXItemData, object, context);
    } else {
      idsMapping.set(String(id), object.getInstanceId());
      object.definition = { ...entry };
      this.objects.set(object, context);
    }
  }
}
