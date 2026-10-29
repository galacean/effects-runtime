import { requestResult } from '../../../platform/browser-storage/indexeddb';
import type { AssetEntry, AssetPayload } from '../model/asset-types';
import { ASSET_ROOT } from '../model/asset-types';
import { assertUniqueAssetName } from '../model/asset-validation';
import type { AssetStores } from './asset-stores';

export async function validateAssetWrite (stores: AssetStores, entries: readonly AssetEntry[], payloads: readonly AssetPayload[] = []): Promise<void> {
  const changed = new Map(entries.map(entry => [entry.id, entry]));
  const previous = new Map<string, AssetEntry | undefined>();
  const parents = new Map<string, AssetEntry[]>();

  for (const entry of entries) {
    if (entry.projectId !== stores.projectId) { throw new Error('Assets can only be edited in their own project.'); }
    const old = await requestResult<AssetEntry | undefined>(stores.entries.get(entry.id));

    if (old && old.projectId !== stores.projectId) { throw new Error('This asset belongs to another project.'); }
    previous.set(entry.id, old);
  }
  for (const entry of entries.filter(entry => !entry.deletedAt)) {
    const old = previous.get(entry.id);
    let siblings = parents.get(entry.parentId);

    if (!siblings) {
      siblings = (await requestResult<AssetEntry[]>(stores.entries.index('parentId').getAll(entry.parentId))).filter(sibling => sibling.projectId === stores.projectId);
      parents.set(entry.parentId, siblings);
    }
    if (!old || old.deletedAt || old.name !== entry.name || old.parentId !== entry.parentId) {
      assertUniqueAssetName([...siblings.filter(sibling => !changed.has(sibling.id)), ...entries.filter(sibling => sibling.parentId === entry.parentId)], entry.name, entry.id);
    }
    if (entry.parentId !== ASSET_ROOT) {
      const parent = changed.get(entry.parentId) ?? await requestResult<AssetEntry | undefined>(stores.entries.get(entry.parentId));

      if (parent?.kind !== 'folder' || parent.deletedAt || parent.projectId !== stores.projectId) { throw new Error('Choose an existing content folder.'); }
    }
  }
  for (const payload of payloads) {
    const entry = changed.get(payload.id) ?? await requestResult<AssetEntry | undefined>(stores.entries.get(payload.id));

    if (entry?.projectId !== stores.projectId || entry.kind !== payload.kind) { throw new Error('The asset data does not belong to this project.'); }
  }
}
