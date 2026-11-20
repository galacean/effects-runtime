import type * as spec from '@galacean/effects-specification';
import { getClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { SceneInstantiationContext } from './scene-instantiation-context';
import { VFXItem } from './vfx-item';

/** @internal Creates scene objects and resolves precomposition definitions and instance mappings. */
export class SceneObjectsFactory {
  private constructor () { }

  static spawnComposition (context: SceneInstantiationContext, data: spec.CompositionData): void {
    this.spawnCompositionContents(context, data, context.root);
  }

  static spawnItem (context: SceneInstantiationContext, data: spec.VFXItemData): void {
    context.addObject(context.root, data);
    this.spawnItemContents(context, data, context.root);
  }

  static spawn (context: SceneInstantiationContext, data: spec.EffectsObjectData): EffectsObject | undefined {
    const Constructor = getClass(data.dataType);

    if (!Constructor) {
      console.warn(`Constructor for DataType: ${data.dataType} not found.`);

      return;
    }
    const object: EffectsObject = new Constructor(context.root.engine);

    context.addObject(object, data);
    if (object instanceof VFXItem) {
      this.spawnItemContents(context, data as spec.VFXItemData, object);
    }

    return object;
  }

  static deserialize (context: SceneInstantiationContext, object: EffectsObject, data: spec.EffectsObjectData): void {
    const deserializationContext = context.selectDeserializationContext(object);

    object.engine.effectsObjectServer.withDeserializationContext(deserializationContext, () => {
      object.fromData(data);
    });
  }

  private static spawnCompositionContents (context: SceneInstantiationContext, data: spec.CompositionData, root: VFXItem): void {
    root.sourceScene = context.scene;
    root.definition.id ??= data.id;
    context.bindId(data.id, root);
    // The template and its placement can both refer to the same root.
    context.bindId(root.definition.id, root);
    this.spawnContents(context, data);
  }

  private static spawnItemContents (context: SceneInstantiationContext, data: spec.VFXItemData, item: VFXItem): void {
    item.sourceScene = context.scene;

    const { refId } = data as { refId?: string };
    let template: spec.CompositionData | undefined;

    if (refId !== undefined) {
      template = context.findData(refId) as unknown as spec.CompositionData | undefined;
      if (!template) {
        throw new Error(`Referenced precomposition with Id: ${refId} does not exist.`);
      }
      const compositionData = template;

      context.withNewContext(item, () => this.spawnCompositionContents(context, compositionData, item));
    }
    // Placement additions belong to the containing instance, after the template scope is restored.
    this.spawnContents(context, data, template?.components);
  }

  private static spawnContents (
    context: SceneInstantiationContext,
    data: spec.CompositionData | spec.VFXItemData,
    templateComponents?: spec.DataPath[],
  ): void {
    for (const path of data.components ?? []) {
      if (!templateComponents?.some(component => component.id === path.id)) {
        this.spawnReference(context, path);
      }
    }
    for (const path of data.children ?? []) {
      this.spawnReference(context, path);
    }
  }

  private static spawnReference (context: SceneInstantiationContext, { id }: spec.DataPath): void {
    if (context.hasId(id)) {
      return;
    }
    const data = context.findData(id);

    if (data) {
      this.spawn(context, data);
    }
  }
}
