import { requestResult, runTransaction as transaction } from '../../../platform/browser-storage/indexeddb';
import { DEFAULT_PROJECT_ID } from '../../projects/project-types';
import type { StoredScene } from '../../scene/document/scene-types';
import type { AssetBrowserPreferences, AssetEntry, AssetImage } from '../model/asset-types';
import { ASSET_ROOT } from '../model/asset-types';
import { WORKSPACE_STORES as STORES } from './workspace-schema';

function validateScene (scene: StoredScene): void {
  if (!scene?.id || typeof scene.name !== 'string' || !Number.isFinite(scene.updatedAt) || !scene.scene || !scene.editor?.objects) {
    throw new Error('A saved scene could not be migrated. Its original data has been retained.');
  }
}

function sceneEntry (scene: StoredScene): AssetEntry {
  return { id: scene.id, projectId: DEFAULT_PROJECT_ID, name: scene.name, kind: 'scene', parentId: ASSET_ROOT, createdAt: scene.updatedAt, updatedAt: scene.updatedAt };
}

export class WorkspaceMigrations {
  constructor (private readonly databaseName: string, private readonly legacySceneKey: string, private readonly legacyContentName: string) { }

  upgrade (database: IDBDatabase, tx: IDBTransaction, oldVersion: number, fail: (error: unknown) => void): void {
    const entries = oldVersion < 2 ? database.createObjectStore('assets', { keyPath: 'id' }) : tx.objectStore('assets');
    const payloads = oldVersion < 2 ? database.createObjectStore('assetData', { keyPath: 'id' }) : tx.objectStore('assetData');

    if (oldVersion < 2) {
      entries.createIndex('parentId', 'parentId'); entries.createIndex('name', 'name');
      database.createObjectStore('preferences');
    }
    if (!database.objectStoreNames.contains('workspace')) { database.createObjectStore('workspace', { keyPath: 'key' }); }
    if (database.objectStoreNames.contains('scenes')) {
      const scenes = tx.objectStore('scenes').getAll();

      scenes.onsuccess = () => {
        try {
          for (const scene of scenes.result as StoredScene[]) {
            validateScene(scene); entries.put(sceneEntry(scene));
            payloads.put({ id: scene.id, kind: 'scene', scene: scene.scene, editor: scene.editor });
          }
          database.deleteObjectStore('scenes');
          if (database.objectStoreNames.contains('sceneMetadata')) { database.deleteObjectStore('sceneMetadata'); }
        } catch (error) { fail(error); }
      };
    }
    if (oldVersion < 3) {
      const now = Date.now();

      database.createObjectStore('projects', { keyPath: 'id' }).put({ id: DEFAULT_PROJECT_ID, name: 'My Project', description: '', createdAt: now, updatedAt: now, lastOpenedAt: now });
      entries.createIndex('projectId', 'projectId');
      const cursor = entries.openCursor();

      cursor.onsuccess = () => {
        if (cursor.result) { cursor.result.update({ ...cursor.result.value, projectId: DEFAULT_PROJECT_ID }); cursor.result.continue(); }
      };
      const preferences = tx.objectStore('preferences'), browser = preferences.get('browser');

      browser.onsuccess = () => { if (browser.result) { preferences.put(browser.result, DEFAULT_PROJECT_ID); preferences.delete('browser'); } };
      const workspace = tx.objectStore('workspace'), lastScene = workspace.get('lastSceneId');

      lastScene.onsuccess = () => {
        if (lastScene.result) {
          const key = DEFAULT_PROJECT_ID + ':lastSceneId';

          workspace.put({ key, value: lastScene.result.value }); workspace.delete('lastSceneId');
        }
      };
    }
  }

  async run (database: IDBDatabase): Promise<void> { await this.migrateScenes(database); await this.migrateContent(database); }

  private async migrateScenes (database: IDBDatabase): Promise<void> {
    let original: string | null = null;

    await transaction(database, ['assets', 'assetData', 'workspace'], 'readwrite', async tx => {
      const workspace = tx.objectStore('workspace');

      if (await requestResult(workspace.get('migratedLocalStorageV1'))) { return; }
      original = window.localStorage.getItem(this.legacySceneKey);
      if (original) {
        const library = JSON.parse(original) as { version: number, scenes: StoredScene[], lastSceneId?: string };

        if (library?.version !== 1 || !Array.isArray(library.scenes)) { throw new Error('The legacy scene library has an unsupported format.'); }
        const ids = new Set<string>();

        for (const scene of library.scenes) { validateScene(scene); if (ids.has(scene.id)) { throw new Error('The legacy scene library contains duplicate IDs.'); } ids.add(scene.id); }
        for (const scene of library.scenes) {
          if (await requestResult(tx.objectStore('assets').getKey(scene.id)) !== undefined) { continue; }
          tx.objectStore('assets').put(sceneEntry(scene)); tx.objectStore('assetData').put({ id: scene.id, kind: 'scene', scene: scene.scene, editor: scene.editor });
        }
        const key = DEFAULT_PROJECT_ID + ':lastSceneId';

        if (library.lastSceneId && ids.has(library.lastSceneId) && !await requestResult(workspace.get(key))) { workspace.put({ key, value: library.lastSceneId }); }
      }
      workspace.put({ key: 'migratedLocalStorageV1', value: true });
    });
    if (original !== null) {
      try { if (window.localStorage.getItem(this.legacySceneKey) === original) { window.localStorage.removeItem(this.legacySceneKey); } } catch (error) { console.warn('The old scene backup could not be removed.', error); }
    }
  }

  private async migrateContent (database: IDBDatabase): Promise<void> {
    const migrated = await transaction(database, ['workspace'], 'readonly', tx => requestResult(tx.objectStore('workspace').get('migratedContentV1')));

    const legacy = await this.readLegacyContent();

    if (migrated && !legacy) { return; }
    await transaction(database, STORES, 'readwrite', async tx => {
      if (legacy) {
        const images = new Map(legacy.images.map(image => [image.id, image]));

        for (const entry of legacy.entries) {
          if (!entry?.id || !['folder', 'texture'].includes(entry.kind)) { throw new Error('The old content library contains an invalid asset.'); }
          const existing = await requestResult(tx.objectStore('assets').get(entry.id)) as AssetEntry | undefined;

          if (existing) {
            if (existing.kind !== entry.kind) { throw new Error('Two legacy assets share the same ID. Their original data has been retained.'); }
            continue;
          }
          if (entry.kind === 'texture') {
            const image = images.get(entry.id);

            if (!image) { throw new Error('The original image is missing: ' + entry.name); }
            tx.objectStore('assetData').put({ ...image, kind: 'texture' });
          }
          let name = entry.name, suffix = 1;
          const siblings = (await requestResult<AssetEntry[]>(tx.objectStore('assets').index('parentId').getAll(entry.parentId))).filter(entry => entry.projectId === DEFAULT_PROJECT_ID);

          if (!entry.deletedAt) {
            while (siblings.some(sibling => !sibling.deletedAt && sibling.name.toLowerCase() === name.toLowerCase())) { name = entry.name + '_' + suffix++; }
          }
          tx.objectStore('assets').put({ ...entry, name, projectId: DEFAULT_PROJECT_ID });
        }
        if (legacy.preferences && !await requestResult(tx.objectStore('preferences').get(DEFAULT_PROJECT_ID))) { tx.objectStore('preferences').put(legacy.preferences, DEFAULT_PROJECT_ID); }
      }
      tx.objectStore('workspace').put({ key: 'migratedContentV1', value: true });
    });
    if (legacy) {
      try { await this.retireLegacyContent(); } catch (error) { console.warn('Assets were migrated; the old store could not be retired yet.', error); }
    }
  }

  private retireLegacyContent (): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.legacyContentName, 3);

      request.onupgradeneeded = () => {
        const database = request.result;

        for (const store of ['entries', 'images', 'preferences']) { if (database.objectStoreNames.contains(store)) { database.deleteObjectStore(store); } }
        const migration = database.objectStoreNames.contains('migration') ? request.transaction!.objectStore('migration') : database.createObjectStore('migration');

        migration.put({ database: this.databaseName, version: 3 }, 'target');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('An older editor tab is still reading the old asset store.'));
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
  }

  private async readLegacyContent (): Promise<{ entries: AssetEntry[], images: AssetImage[], preferences?: AssetBrowserPreferences } | undefined> {
    if (typeof indexedDB.databases === 'function' && !(await indexedDB.databases()).some(database => database.name === this.legacyContentName)) { return; }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.legacyContentName);
      let absent = false;

      request.onupgradeneeded = () => { absent = true; request.transaction!.abort(); };
      request.onerror = () => absent ? resolve(undefined) : reject(request.error);
      const read = (legacy: IDBDatabase): void => {
        legacy.onversionchange = () => legacy.close();
        void transaction(legacy, ['entries', 'images', 'preferences'], 'readonly', async tx => {
          const [entries, images, preferences] = await Promise.all([
            requestResult<AssetEntry[]>(tx.objectStore('entries').getAll()), requestResult<AssetImage[]>(tx.objectStore('images').getAll()), requestResult<AssetBrowserPreferences | undefined>(tx.objectStore('preferences').get('browser')),
          ]);

          return { entries, images, preferences };
        }).then(resolve, reject).finally(() => legacy.close());
      };

      request.onsuccess = () => {
        const legacy = request.result;

        if (!legacy.objectStoreNames.contains('entries')) {
          legacy.close(); resolve(undefined);

          return;
        }
        if (legacy.version < 2) {
          legacy.close();
          const freeze = indexedDB.open(this.legacyContentName, 2);

          freeze.onerror = () => reject(freeze.error);
          freeze.onblocked = () => reject(new Error('Close older editor tabs to migrate their asset library.'));
          freeze.onsuccess = () => read(freeze.result);
        } else { read(legacy); }
      };
    });
  }
}
