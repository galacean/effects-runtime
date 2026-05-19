import { spec } from '@galacean/effects';
import { describe, expect, it } from 'vitest';
import { findElement, getComponentItemIds, getCompositionComponents } from '@galacean/effects-helper';

const sceneUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*U47LQ7QY9YYAAAAARMAAAAgAelB4AQ';

async function loadSceneFixture (): Promise<spec.JSONScene> {
  const response = await fetch(sceneUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch scene JSON: ${response.status}`);
  }

  return await response.json() as spec.JSONScene;
}

function getObjectId (value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { id?: unknown };

  return typeof candidate.id === 'string' ? candidate.id : null;
}

describe('scene-ops/element/query getCompositionComponents', () => {
  it('returns only referenced composition components from real scene json', async () => {
    const scene = await loadSceneFixture();
    const components = getCompositionComponents(scene);
    const componentIds = components.map(component => component.id);

    expect(componentIds).toEqual([
      'a5ac34fee4514bef92c3dac62b21708f',
      'd3bd8ebb892843a1880a2abb6e557b76',
      '91b86e5d1fcc4b549ce6527be4c1683e',
      'caf489ed8b7e49c2a8d9b2d5c209bb0c',
    ]);
  });
});

describe('scene-ops/element/query getComponentItemIds', () => {
  it('returns non-empty component item id set for real scene json', async () => {
    const scene = await loadSceneFixture();
    const componentItemIds = getComponentItemIds(scene);

    expect(componentItemIds.size).toBeGreaterThan(0);
  });

  it('finds component item in composition container instead of root container', async () => {
    const scene = await loadSceneFixture();
    const componentItemIds = getComponentItemIds(scene);

    expect(componentItemIds.size).toBeGreaterThan(0);

    const targetId = Array.from(componentItemIds)[0];
    const match = findElement(scene, targetId);

    expect(match).not.toBeNull();
    expect(match?.containerType).toBe('composition');
    expect(match?.element.id).toBe(targetId);
  });

  it('falls back to root container after removing component reference', async () => {
    const scene = await loadSceneFixture();
    const componentItemIds = getComponentItemIds(scene);
    const targetId = Array.from(componentItemIds)[0];
    const sceneWithoutComponentRef = JSON.parse(JSON.stringify(scene)) as spec.JSONScene;

    for (const component of sceneWithoutComponentRef.components) {
      if (component.dataType !== spec.DataType.CompositionComponent) {
        continue;
      }

      const compositionComponent = component as spec.CompositionComponentData;

      compositionComponent.items = compositionComponent.items.filter(item => getObjectId(item) !== targetId);
    }

    const afterIds = getComponentItemIds(sceneWithoutComponentRef);

    expect(afterIds.has(targetId)).toBe(false);

    const match = findElement(sceneWithoutComponentRef, targetId);

    expect(match).not.toBeNull();
    expect(match?.containerType).toBe('root');
    expect(match?.element.id).toBe(targetId);
  });
});
