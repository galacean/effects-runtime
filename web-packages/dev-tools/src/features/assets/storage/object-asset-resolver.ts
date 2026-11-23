import type { AssetEntry, AssetObjectData, AssetPayload } from '../model/asset-types';
import { isObjectAsset } from '../model/asset-types';
import { validateObjectAsset } from '../model/object-asset-data';

export async function resolveObjectAssets (root: unknown, entries: readonly AssetEntry[], read: (id: string) => Promise<AssetPayload | undefined>): Promise<AssetObjectData[]> {
  const assets = new Map(entries.filter(entry => ['material', 'shader', 'sprite'].includes(entry.kind)).map(entry => [entry.id, entry]));
  const queue = new Set<string>(), visited = new Set<string>(), objects = new Map<string, AssetObjectData>();
  const scan = (value: unknown): void => {
    if (!value || typeof value !== 'object') { return; }
    if ('id' in value && typeof value.id === 'string' && assets.has(value.id)) { queue.add(value.id); }
    Object.values(value).forEach(scan);
  };

  scan(root);
  for (const id of queue) {
    if (visited.has(id)) { continue; }
    visited.add(id);
    const payload = await read(id);

    if (!payload || !isObjectAsset(payload)) { throw new Error('An asset used by this scene is missing: ' + assets.get(id)!.name); }
    validateObjectAsset(payload);
    for (const definition of payload.objects) {
      const data = structuredClone(definition);

      if (data.id === id) { data.name = assets.get(id)!.name; }
      objects.set(data.id, data);
    }
    scan(payload.objects);
  }

  return [...objects.values()];
}
