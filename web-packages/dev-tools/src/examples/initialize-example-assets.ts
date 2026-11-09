import { generateGUID } from '@galacean/effects';
import type { AssetEntry, AssetScene } from '../features/assets/model/asset-types';
import { ASSET_ROOT } from '../features/assets/model/asset-types';
import { validateAssetWrite } from '../features/assets/storage/asset-write-validation';
import type { WorkspaceRepository } from '../features/assets/storage/workspace-repository';
import { DEFAULT_PROJECT_ID } from '../features/projects/project-types';
import { requestResult } from '../platform/browser-storage/indexeddb';
import { createVectorStrokeScene } from './scenes/vector-stroke-scene';

const EXAMPLE_SCENES = [
  { key: 'vector-stroke', revision: 6, name: 'Vector Strokes', create: createVectorStrokeScene },
];

interface ExampleSetting { value: string | { id: string, revision: number, updatedAt?: number } }

/** Seed the starter project once per example, retaining user edits and deletions. */
export async function initializeExampleAssets (storage: WorkspaceRepository): Promise<void> {
  const project = await storage.getProject(DEFAULT_PROJECT_ID);

  if (!project || project.deletedAt) { return; }
  await storage.mutate(async stores => {
    const existing = await requestResult<AssetEntry[]>(stores.entries.index('projectId').getAll(DEFAULT_PROJECT_ID));
    const entries: AssetEntry[] = [], payloads: AssetScene[] = [];
    const now = Date.now();
    const folderKey = DEFAULT_PROJECT_ID + ':exampleScenesFolderId';
    const folderSetting = await requestResult<{ value: string } | undefined>(stores.workspace.get(folderKey));
    let folder = existing.find(entry => entry.kind === 'folder' && !entry.deletedAt &&
      (entry.id === folderSetting?.value || entry.parentId === ASSET_ROOT && entry.name.toLowerCase() === 'examples'));
    const uniqueName = (base: string, parentId: string, exceptId?: string): string => {
      let name = base, suffix = 1;

      while ([...existing, ...entries].some(entry => entry.id !== exceptId && !entry.deletedAt && entry.parentId === parentId && entry.name.toLowerCase() === name.toLowerCase())) { name = base + '_' + suffix++; }

      return name;
    };

    for (const example of EXAMPLE_SCENES) {
      const key = DEFAULT_PROJECT_ID + ':exampleScene:' + example.key;
      const previous = await requestResult<ExampleSetting | undefined>(stores.workspace.get(key));

      if (previous) {
        const { id, revision, updatedAt } = typeof previous.value === 'string' ? { id: previous.value, revision: 1, updatedAt: undefined } : previous.value;

        if (revision < example.revision) {
          const entry = existing.find(entry => entry.id === id);

          // Refresh untouched starter content while retaining saved user changes and deletions.
          const untouched = entry && (entry.updatedAt === (updatedAt ?? entry.createdAt) ||
            revision === 2 && updatedAt === undefined && entry.name === 'Bezier Shape');

          if (entry?.kind === 'scene' && !entry.deletedAt && untouched) {
            entries.push({ ...entry, name: uniqueName(example.name, entry.parentId, id), updatedAt: now });
            payloads.push({ id, kind: 'scene', scene: example.create(), editor: { objects: {} } });
          }
          stores.workspace.put({ key, value: { id, revision: example.revision, updatedAt: payloads.some(payload => payload.id === id) ? now : updatedAt } });
        }
        continue;
      }
      if (!folder) {
        folder = { id: generateGUID(), projectId: DEFAULT_PROJECT_ID, parentId: ASSET_ROOT, name: uniqueName('Examples', ASSET_ROOT), kind: 'folder', createdAt: now, updatedAt: now };
        entries.push(folder);
      }
      stores.workspace.put({ key: folderKey, value: folder.id });
      const id = generateGUID();

      entries.push({ id, projectId: DEFAULT_PROJECT_ID, parentId: folder.id, name: uniqueName(example.name, folder.id), kind: 'scene', createdAt: now, updatedAt: now });
      payloads.push({ id, kind: 'scene', scene: example.create(), editor: { objects: {} } });
      stores.workspace.put({ key, value: { id, revision: example.revision, updatedAt: now } });
    }
    await validateAssetWrite(stores, entries, payloads);
    entries.forEach(entry => stores.entries.put(entry));
    payloads.forEach(payload => stores.payloads.put(payload));

    return entries;
  }, DEFAULT_PROJECT_ID);
}
