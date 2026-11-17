import { Engine, Material, Shader } from '@galacean/effects';
import { newObjectAsset } from '../../../../dev-tools/src/features/assets/model/object-asset-data';
import { AssetObjectCache } from '../../../../dev-tools/src/features/assets/runtime/asset-object-cache';

const { expect } = chai;

describe('dev-tools/assets/AssetObjectCache', () => {
  it('loads and refreshes shaders by file ID while keeping live materials bound', async () => {
    const engine = new Engine(document.createElement('canvas'), { glType: 'webgl2' });
    const projectId = 'asset-cache-test';
    const shaderId = 'project-shader';
    const materialId = 'project-material';
    const shaderData = newObjectAsset('shader', shaderId, 'Test Shader');
    const materialData = newObjectAsset('material', materialId, 'Test Material', shaderId);
    const payloads = [shaderData, materialData];
    const entries = payloads.map(({ id, kind }) => ({ id, kind, projectId, parentId: 'content', name: id, createdAt: 1, updatedAt: 1 }));
    const cache = new AssetObjectCache({
      projectId: () => projectId,
      entry: id => entries.find(entry => entry.id === id),
      payload: async id => payloads.find(payload => payload.id === id),
      loadTexture: async () => { throw new Error('Unexpected external texture'); },
    });

    try {
      const original = await cache.load(engine, shaderId) as Shader;
      const material = await cache.load(engine, materialId) as Material;

      expect(original).to.be.instanceOf(Shader);
      expect(material).to.be.instanceOf(Material);
      expect(original.getInstanceId()).not.to.equal(shaderId);
      expect(await cache.load(engine, shaderId)).to.equal(original);
      expect(material.shader).to.equal(original);

      const fragment = `${original.shaderData.fragment}\n// Edited shader`;

      shaderData.objects[0].fragment = fragment;
      entries[0].updatedAt++;
      await cache.refresh(entries[0]);

      const refreshed = cache.get(engine, shaderId) as Shader;

      expect(refreshed).to.be.instanceOf(Shader);
      expect(refreshed).not.to.equal(original);
      expect(refreshed.shaderData.fragment).to.equal(fragment);
      expect(original.isRegistered).to.equal(false);
      expect(material.shader).to.equal(refreshed);
    } finally {
      engine.dispose();
    }
  });
});
