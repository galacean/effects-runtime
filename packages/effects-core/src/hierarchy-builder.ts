import type * as spec from '@galacean/effects-specification';
import { Component } from './components/component';
import { getClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { DeserializationContext } from './effects-object-server';
import type { Engine } from './engine';
import { VFXItem } from './vfx-item';

/** Creates hierarchy objects before deserializing their references. */
export class HierarchyBuilder {
  private readonly objects = new Map<EffectsObject, DeserializationContext>();

  constructor (private readonly engine: Engine) { }

  spawnComposition (data: spec.CompositionData, item: VFXItem): void {
    const context = createDeserializationContext(data.id, item);

    // The composition and its placement can both refer to the same root.
    if (item.definition.id !== undefined) {
      context.idsMapping.set(String(item.definition.id), item.getInstanceId());
    }
    this.spawnContents(data, context);
  }

  spawnItem (
    data: spec.VFXItemData,
    item: VFXItem,
    context = createDeserializationContext(data.id, item),
  ): void {
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

  deserialize (): void {
    const objectServer = this.engine.effectsObjectServer;

    for (const [object, context] of this.objects) {
      objectServer.withDeserializationContext(context, () => {
        object.fromData(object.definition as spec.EffectsObjectData);
        // Serialized items apply their visibility after each component reads its own enabled state.
        if (object instanceof Component && this.objects.has(object.item)) {
          object.enabled = object.item.isVisible;
        }
      });
    }
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

    idsMapping.set(String(id), object.getInstanceId());
    if (object instanceof VFXItem) {
      this.spawnItem(entry as spec.VFXItemData, object, context);
    } else {
      object.definition = { ...entry };
      this.objects.set(object, context);
    }
  }
}

function createDeserializationContext (id: string, root: VFXItem): DeserializationContext {
  return { root, idsMapping: new Map([[String(id), root.getInstanceId()]]) };
}
