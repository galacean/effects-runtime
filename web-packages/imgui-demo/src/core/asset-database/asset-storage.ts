import type { StoredScene } from '../scene-document/scene-storage';
import { ASSET_ROOT } from './asset-types';
import type { AssetEntry, AssetImage, AssetPayload, AssetPreferences } from './asset-types';

interface AssetStores {
  entries: IDBObjectStore,
  payloads: IDBObjectStore,
  preferences: IDBObjectStore,
  workspace: IDBObjectStore,
}
type Listener = (entries: AssetEntry[]) => void;
const STORES = ['assets', 'assetData', 'preferences', 'workspace'];

export function assetRequest<T> (request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The asset database request failed.'));
  });
}

function transaction<T> (database: IDBDatabase, names: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(names, mode);
    let result: T, failure: unknown;

    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('The asset database transaction was aborted.'));
    void (async () => {
      try { result = await action(tx); } catch (error) {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      }
    })();
  });
}

function validateScene (scene: StoredScene): void {
  if (!scene?.id || typeof scene.name !== 'string' || !Number.isFinite(scene.updatedAt) || !scene.scene || !scene.editor?.objects) {
    throw new Error('A saved scene could not be migrated. Its original data has been retained.');
  }
}

function sceneEntry (scene: StoredScene): AssetEntry {
  return { id: scene.id, name: scene.name, kind: 'scene', parentId: ASSET_ROOT, createdAt: scene.updatedAt, updatedAt: scene.updatedAt };
}

export class AssetStorage {
  private connection?: IDBDatabase;
  private initialization?: Promise<void>;
  private listeners = new Set<Listener>();
  private channel?: BroadcastChannel;

  constructor (private readonly databaseName = 'effects-editor', private readonly legacySceneKey = 'effects-editor.scenes.v1', private readonly legacyContentName = 'effects-editor-content') { }

  subscribe (listener: Listener): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  initialize (): Promise<void> {
    this.initialization ??= (async () => {
      const database = await this.open();

      await this.migrateScenes(database); await this.migrateContent(database);
      if (typeof BroadcastChannel !== 'undefined' && !this.channel) {
        this.channel = new BroadcastChannel(this.databaseName + '.assets');
        this.channel.onmessage = event => {
          const entries = event.data?.entries;

          if (Array.isArray(entries) && entries.every(entry => entry && typeof entry.id === 'string' && ['folder', 'texture', 'scene'].includes(entry.kind))) {
            this.notify(entries, false);
          }
        };
      }
    })().catch(error => { this.initialization = undefined; throw error; });

    return this.initialization;
  }

  async close (): Promise<void> {
    await this.initialization?.catch(() => {});
    this.channel?.close(); this.channel = undefined;
    this.connection?.close(); this.connection = undefined; this.initialization = undefined;
  }

  private async database (): Promise<IDBDatabase> {
    await this.initialize();

    return this.connection!;
  }

  private open (): Promise<IDBDatabase> {
    if (this.connection) { return Promise.resolve(this.connection); }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2);
      let blocked = false, upgradeError: unknown;

      request.onupgradeneeded = () => {
        const database = request.result, tx = request.transaction!;
        const entries = database.createObjectStore('assets', { keyPath: 'id' });
        const payloads = database.createObjectStore('assetData', { keyPath: 'id' });

        entries.createIndex('parentId', 'parentId'); entries.createIndex('name', 'name');
        database.createObjectStore('preferences');
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
            } catch (error) { upgradeError = error; tx.abort(); }
          };
        }
      };
      request.onerror = () => reject(upgradeError ?? request.error ?? new Error('Unable to open the asset database.'));
      request.onblocked = () => { blocked = true; reject(new Error('Close older editor tabs to finish updating the asset database.')); };
      request.onsuccess = () => {
        const database = request.result;

        if (blocked) {
          database.close();

          return;
        }
        database.onversionchange = () => { database.close(); this.connection = undefined; this.initialization = undefined; };
        database.onclose = () => { if (this.connection === database) { this.connection = undefined; this.initialization = undefined; } };
        this.connection = database; resolve(database);
      };
    });
  }

  private async read<T> (store: string, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.database();

    return transaction(database, [store], 'readonly', tx => assetRequest(action(tx.objectStore(store))));
  }

  list (): Promise<AssetEntry[]> { return this.read('assets', store => store.getAll()); }
  entry (id: string): Promise<AssetEntry | undefined> { return this.read('assets', store => store.get(id)); }
  payload (id: string): Promise<AssetPayload | undefined> { return this.read('assetData', store => store.get(id)); }
  preferences (): Promise<AssetPreferences | undefined> { return this.read('preferences', store => store.get('browser')); }
  async image (id: string): Promise<AssetImage | undefined> {
    const payload = await this.payload(id);

    return payload?.kind === 'texture' ? payload : undefined;
  }
  async setting<T> (key: string): Promise<T | undefined> { return (await this.read('workspace', store => store.get(key)))?.value; }

  async mutate (action: (stores: AssetStores) => AssetEntry[] | Promise<AssetEntry[]>): Promise<void> {
    const database = await this.database();
    const entries = await transaction(database, STORES, 'readwrite', tx => action({
      entries: tx.objectStore('assets'), payloads: tx.objectStore('assetData'), preferences: tx.objectStore('preferences'), workspace: tx.objectStore('workspace'),
    }));

    if (entries.length) { this.notify(entries); }
  }

  async write (entries: AssetEntry[], payloads: AssetPayload[] = [], preferences?: AssetPreferences): Promise<void> {
    await this.mutate(async stores => {
      const changed = new Map(entries.map(entry => [entry.id, entry]));
      const parents = new Map<string, AssetEntry[]>();

      for (const entry of entries.filter(entry => !entry.deletedAt)) {
        let siblings = parents.get(entry.parentId);

        if (!siblings) { siblings = await assetRequest<AssetEntry[]>(stores.entries.index('parentId').getAll(entry.parentId)); parents.set(entry.parentId, siblings); }
        const previous = siblings.find(previous => previous.id === entry.id);

        if (!previous || previous.deletedAt || previous.name !== entry.name) {
          const others = [...siblings.filter(sibling => !changed.has(sibling.id)), ...entries.filter(sibling => sibling.parentId === entry.parentId)];

          if (others.some(other => other.id !== entry.id && !other.deletedAt && other.name.toLowerCase() === entry.name.toLowerCase())) { throw new Error('An asset named "' + entry.name + '" already exists in this folder.'); }
        }
        if (entry.parentId !== ASSET_ROOT) {
          const parent = changed.get(entry.parentId) ?? await assetRequest<AssetEntry | undefined>(stores.entries.get(entry.parentId));

          if (parent?.kind !== 'folder' || parent.deletedAt) { throw new Error('Choose an existing content folder.'); }
        }
      }
      entries.forEach(entry => stores.entries.put(entry)); payloads.forEach(payload => stores.payloads.put(payload));
      if (preferences) { stores.preferences.put(preferences, 'browser'); }

      return entries;
    });
  }

  private notify (entries: AssetEntry[], broadcast = true): void {
    this.listeners.forEach(listener => { try { listener(entries); } catch (error) { console.error('The asset view could not be refreshed:', error); } });
    if (broadcast) { this.channel?.postMessage({ entries }); }
  }

  private async migrateScenes (database: IDBDatabase): Promise<void> {
    let original: string | null = null;

    await transaction(database, ['assets', 'assetData', 'workspace'], 'readwrite', async tx => {
      const workspace = tx.objectStore('workspace');

      if (await assetRequest(workspace.get('migratedLocalStorageV1'))) { return; }
      original = window.localStorage.getItem(this.legacySceneKey);
      if (original) {
        const library = JSON.parse(original) as { version: number, scenes: StoredScene[], lastSceneId?: string };

        if (library?.version !== 1 || !Array.isArray(library.scenes)) { throw new Error('The legacy scene library has an unsupported format.'); }
        const ids = new Set<string>();

        for (const scene of library.scenes) { validateScene(scene); if (ids.has(scene.id)) { throw new Error('The legacy scene library contains duplicate IDs.'); } ids.add(scene.id); }
        for (const scene of library.scenes) {
          if (await assetRequest(tx.objectStore('assets').getKey(scene.id)) !== undefined) { continue; }
          tx.objectStore('assets').put(sceneEntry(scene)); tx.objectStore('assetData').put({ id: scene.id, kind: 'scene', scene: scene.scene, editor: scene.editor });
        }
        if (library.lastSceneId && ids.has(library.lastSceneId) && !await assetRequest(workspace.get('lastSceneId'))) { workspace.put({ key: 'lastSceneId', value: library.lastSceneId }); }
      }
      workspace.put({ key: 'migratedLocalStorageV1', value: true });
    });
    if (original !== null) {
      try { if (window.localStorage.getItem(this.legacySceneKey) === original) { window.localStorage.removeItem(this.legacySceneKey); } } catch (error) { console.warn('The old scene backup could not be removed.', error); }
    }
  }

  private async migrateContent (database: IDBDatabase): Promise<void> {
    const migrated = await transaction(database, ['workspace'], 'readonly', tx => assetRequest(tx.objectStore('workspace').get('migratedContentV1')));

    const legacy = await this.readLegacyContent();

    if (migrated && !legacy) { return; }
    await transaction(database, STORES, 'readwrite', async tx => {
      if (legacy) {
        const images = new Map(legacy.images.map(image => [image.id, image]));

        for (const entry of legacy.entries) {
          if (!entry?.id || !['folder', 'texture'].includes(entry.kind)) { throw new Error('The old content library contains an invalid asset.'); }
          const existing = await assetRequest(tx.objectStore('assets').get(entry.id)) as AssetEntry | undefined;

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
          const siblings = await assetRequest<AssetEntry[]>(tx.objectStore('assets').index('parentId').getAll(entry.parentId));

          if (!entry.deletedAt) {
            while (siblings.some(sibling => !sibling.deletedAt && sibling.name.toLowerCase() === name.toLowerCase())) { name = entry.name + '_' + suffix++; }
          }
          tx.objectStore('assets').put({ ...entry, name });
        }
        if (legacy.preferences && !await assetRequest(tx.objectStore('preferences').get('browser'))) { tx.objectStore('preferences').put(legacy.preferences, 'browser'); }
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

        migration.put({ database: this.databaseName, version: 2 }, 'target');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('An older editor tab is still reading the old asset store.'));
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
  }

  private async readLegacyContent (): Promise<{ entries: AssetEntry[], images: AssetImage[], preferences?: AssetPreferences } | undefined> {
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
            assetRequest<AssetEntry[]>(tx.objectStore('entries').getAll()), assetRequest<AssetImage[]>(tx.objectStore('images').getAll()), assetRequest<AssetPreferences | undefined>(tx.objectStore('preferences').get('browser')),
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

export const assetStorage = new AssetStorage();
