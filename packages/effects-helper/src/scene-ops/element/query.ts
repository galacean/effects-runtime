import { spec } from '@galacean/effects';
import {
  getComponents,
  getCompositions,
  getItems,
  isCompositionComponentData,
  isObjectWithId,
} from '../utils';
import type { ElementMatch } from './types';

export function findElement (scene: spec.JSONScene, value: string): ElementMatch | null {
  const items = getItems(scene);
  const rootMatch = findInRoot(scene, items, value);

  if (rootMatch) {
    return rootMatch;
  }

  return findInCompositions(scene, items, value);
}

function findInRoot (
  scene: spec.JSONScene,
  items: spec.VFXItemData[],
  elementId: string,
): ElementMatch | null {
  const componentItemIds = getComponentItemIds(scene);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (componentItemIds.has(item.id)) {
      continue;
    }
    if (item.id === elementId) {
      return { index, element: item, container: items, containerType: 'root' };
    }
  }

  return null;
}

function findInCompositions (
  scene: spec.JSONScene,
  items: spec.VFXItemData[],
  elementId: string,
): ElementMatch | null {
  const components = getCompositionComponents(scene);

  for (const component of components) {
    for (let index = 0; index < component.items.length; index += 1) {
      const item = resolveContainerEntry(items, component.items[index]);

      if (!item || item.id !== elementId) {
        continue;
      }

      return {
        index,
        element: item,
        container: component.items,
        containerType: 'composition',
        component,
      };
    }
  }

  return null;
}

function resolveContainerEntry (items: spec.VFXItemData[], value: spec.VFXItemData | spec.DataPath): spec.VFXItemData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { id?: unknown, dataType?: unknown };

  if (candidate.dataType === 'VFXItemData' && typeof candidate.id === 'string') {
    return value as spec.VFXItemData;
  }

  if (typeof candidate.id !== 'string') {
    return null;
  }

  return items.find(item => item.id === candidate.id) || null;
}

export function getComponentItemIds (scene: spec.JSONScene): Set<string> {
  const ids = new Set<string>();

  for (const component of getCompositionComponents(scene)) {
    for (const item of component.items) {
      if (typeof item?.id === 'string' && item.id !== '') {
        ids.add(item.id);
      }
    }
  }

  return ids;
}

export function getCompositionComponents (scene: spec.JSONScene): spec.CompositionComponentData[] {
  const components = getComponents(scene);
  const compositions = getCompositions(scene).filter(({ components = [] }) => components.every(isObjectWithId));
  const compositionComponents = components
    .filter(component => component.dataType === spec.DataType.CompositionComponent)
    .filter(isCompositionComponentData);
  const componentIds = new Set(compositions.flatMap(({ components = [] }) => components.map(component => component.id)));

  return compositionComponents.filter(component => componentIds.has(component.id));
}

export function resolveMainCompositionComponent (scene: spec.JSONScene): spec.CompositionComponentData | null {
  const components = getCompositionComponents(scene);
  const rootComposition = scene.compositions.find(item => item.id === scene.compositionId) || scene.compositions[0];
  const compositionComponentId = rootComposition?.components?.[0]?.id;

  if (typeof compositionComponentId !== 'string') {
    return components[0] || null;
  }

  return components.find(component => component.id === compositionComponentId) || null;
}
