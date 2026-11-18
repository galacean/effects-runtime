import type { EffectsObject, VFXItem } from '@galacean/effects';
import { HierarchyBuilder, generateGUID, spec } from '@galacean/effects';

/** Build editor roots together to resolve references among them, then detach them for placement. */
export function instantiateItems (paths: readonly spec.DataPath[], sceneRoot: VFXItem): ReadonlyMap<string, EffectsObject> {
  const group = HierarchyBuilder.instantiateItem({
    id: generateGUID(), dataType: spec.DataType.VFXItemData, name: '', type: spec.ItemType.null,
    duration: 0, endBehavior: spec.EndBehavior.freeze, components: [], children: [...paths], content: {},
  }, sceneRoot.engine);
  const objectsById = new Map<string, EffectsObject>();
  const index = (object: EffectsObject) => {
    const { id } = object.definition;

    if (id !== undefined && object.isRegistered) {
      objectsById.set(String(id), object);
    }
  };

  for (const item of group.getDescendants()) {
    index(item);
    item.components.forEach(index);
  }
  if (group.sceneAssets) {
    group.sceneAssets.forEach(index);
    sceneRoot.addSceneAssets(group.sceneAssets);
    group.sceneAssets.clear();
  }
  for (const item of group.children.slice()) {
    item.setParent(null);
  }
  group.dispose();

  return objectsById;
}
