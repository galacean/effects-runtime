import type * as spec from '@galacean/effects-specification';
import type { Composition } from './composition';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import { SceneInstantiationContext } from './scene-instantiation-context';
import { SceneObjectsFactory } from './scene-objects-factory';
import { VFXItem } from './vfx-item';

/**
 * @hidden
 * Internal utility.
 * Not part of the public API — do not rely on this in your code.
 */
export class SceneLoader {
  private constructor () { }

  static async load (scene: Scene.LoadType, engine: Engine, options: SceneLoadOptions = {}): Promise<Composition> {
    return engine.sceneServer.loadScene(scene, options);
  }

  /** Instantiate a main scene or precomposition, creating the root when one is not supplied. */
  static instantiateComposition (
    data: spec.CompositionData | undefined,
    engine: Engine,
    scene?: Scene,
    root?: VFXItem,
  ): VFXItem {
    const rootItem = root ?? new VFXItem(engine);

    if (!root) {
      rootItem.sourceScene = scene;
      if (data) {
        rootItem.definition.id = data.id;
        rootItem.name = data.name;
        rootItem.duration = data.duration;
        rootItem.endBehavior = data.endBehavior;
      }
    }

    if (!data) {
      return rootItem;
    }
    const context = new SceneInstantiationContext(rootItem, scene);

    context.withSceneData(() => {
      SceneObjectsFactory.spawnComposition(context, data);
      this.finish(context);
    });

    return rootItem;
  }

  static instantiateItem (data: spec.VFXItemData, engine: Engine, assetRoot?: VFXItem, scene = assetRoot?.sourceScene): VFXItem {
    const item = new VFXItem(engine);
    const context = new SceneInstantiationContext(item, scene);

    context.withSceneData(() => {
      SceneObjectsFactory.spawnItem(context, data);
      this.finish(context, assetRoot);
    });

    return item;
  }

  private static finish (context: SceneInstantiationContext, assetRoot?: VFXItem): void {
    // Every scene object must exist before any object reads its references.
    for (const object of context.objects) {
      SceneObjectsFactory.deserialize(context, object, object.definition as spec.EffectsObjectData);
    }
    context.registerSceneAssets(assetRoot);
  }
}
