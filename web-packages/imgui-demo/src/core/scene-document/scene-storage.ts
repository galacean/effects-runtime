import type { Keyframe, spec } from '@galacean/effects';

export interface SequenceChannelEditorData {
  group: string,
  axis: number,
  defaultValue: number,
  source: string,
  keys: (Keyframe & { tangentMode: 'auto' | 'user' | 'break' })[],
}

export interface SequenceEditorData {
  timelineId: string,
  sections: Record<string, SequenceChannelEditorData[]>,
}

export interface SceneEditorData {
  objects: Record<string, Record<string, any>>,
  sequences?: Record<string, SequenceEditorData>,
}

export interface SceneMetadata {
  id: string,
  name: string,
  updatedAt: number,
}

export interface StoredScene extends SceneMetadata {
  scene: spec.JSONScene,
  editor: SceneEditorData,
}

interface SceneLibrary {
  version: 1,
  lastSceneId?: string,
  scenes: StoredScene[],
}

const SCENES = 'scenes';
const METADATA = 'sceneMetadata';
const WORKSPACE = 'workspace';
const LAST_SCENE = 'lastSceneId';
const MIGRATED = 'migratedLocalStorageV1';

function requestResult<T> (request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The scene database request failed.'));
  });
}

/** Resolve only after commit, including when all individual requests have succeeded. */
function transaction<T> (database: IDBDatabase, stores: string[], mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(stores, mode);
    let result: T;
    let failure: unknown;

    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('The scene database transaction was aborted.'));
    void (async () => {
      try { result = await action(tx); } catch (error) {
        failure = error;
        try { tx.abort(); } catch { reject(error); }
      }
    })();
  });
}

function metadata (scene: StoredScene): SceneMetadata {
  return { id: scene.id, name: scene.name, updatedAt: scene.updatedAt };
}

function validateScene (scene: StoredScene): void {
  if (!scene || typeof scene.id !== 'string' || !scene.id || typeof scene.name !== 'string' ||
    !Number.isFinite(scene.updatedAt) || !scene.scene || !scene.editor || !scene.editor.objects) {
    throw new Error('The local scene library contains an invalid scene.');
  }
}

export class SceneStorage {
  private connection?: IDBDatabase;
  private initialization?: Promise<void>;

  constructor (private readonly databaseName = 'effects-editor', private readonly legacyKey = 'effects-editor.scenes.v1') { }

  initialize (): Promise<void> {
    this.initialization ??= this.open().then(database => this.migrate(database)).catch(error => {
      this.initialization = undefined;

      throw error;
    });

    return this.initialization;
  }

  async close (): Promise<void> {
    await this.initialization?.catch(() => {});
    this.connection?.close();
    this.connection = undefined; this.initialization = undefined;
  }

  async list (): Promise<SceneMetadata[]> {
    const database = await this.database();
    const entries = await transaction(database, [METADATA], 'readonly', tx => requestResult<SceneMetadata[]>(tx.objectStore(METADATA).getAll()));

    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get (id: string): Promise<StoredScene | undefined> {
    const database = await this.database();

    return transaction(database, [SCENES], 'readonly', tx => requestResult(tx.objectStore(SCENES).get(id)));
  }

  async findByName (name: string): Promise<SceneMetadata | undefined> {
    const database = await this.database();

    return transaction(database, [METADATA], 'readonly', tx => requestResult(tx.objectStore(METADATA).index('name').get(name)));
  }

  async last (): Promise<StoredScene | undefined> {
    const database = await this.database();

    return transaction(database, [SCENES, WORKSPACE], 'readonly', async tx => {
      const setting = await requestResult(tx.objectStore(WORKSPACE).get(LAST_SCENE)) as { key: string, value: string } | undefined;

      return setting ? requestResult(tx.objectStore(SCENES).get(setting.value)) : undefined;
    });
  }

  async save (scene: StoredScene): Promise<void> {
    validateScene(scene);
    const database = await this.database();

    await transaction(database, [SCENES, METADATA, WORKSPACE], 'readwrite', tx => {
      tx.objectStore(SCENES).put(scene);
      tx.objectStore(METADATA).put(metadata(scene));
      tx.objectStore(WORKSPACE).put({ key: LAST_SCENE, value: scene.id });
    });
  }

  async select (id: string): Promise<void> {
    const database = await this.database();

    await transaction(database, [WORKSPACE], 'readwrite', tx => {
      tx.objectStore(WORKSPACE).put({ key: LAST_SCENE, value: id });
    });
  }

  private async database (): Promise<IDBDatabase> {
    await this.initialize();

    return this.connection!;
  }

  private open (): Promise<IDBDatabase> {
    if (this.connection) { return Promise.resolve(this.connection); }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      let blocked = false;

      request.onupgradeneeded = () => {
        const database = request.result;

        database.createObjectStore(SCENES, { keyPath: 'id' });
        database.createObjectStore(METADATA, { keyPath: 'id' }).createIndex('name', 'name');
        database.createObjectStore(WORKSPACE, { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to open the scene database.'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('The scene database is being upgraded. Close other editor tabs and try again.'));
      };
      request.onsuccess = () => {
        const database = request.result;

        if (blocked) {
          database.close();

          return;
        }
        database.onversionchange = () => {
          database.close();
          this.connection = undefined; this.initialization = undefined;
        };
        database.onclose = () => {
          if (this.connection === database) { this.connection = undefined; this.initialization = undefined; }
        };
        this.connection = database;
        resolve(database);
      };
    });
  }

  private async migrate (database: IDBDatabase): Promise<void> {
    let legacy: string | null = null;

    await transaction(database, [SCENES, METADATA, WORKSPACE], 'readwrite', async tx => {
      const workspace = tx.objectStore(WORKSPACE);

      if (await requestResult(workspace.get(MIGRATED))) { return; }
      legacy = window.localStorage.getItem(this.legacyKey);
      if (legacy) {
        const library = JSON.parse(legacy) as SceneLibrary | null;

        if (!library || library.version !== 1 || !Array.isArray(library.scenes)) { throw new Error('The local scene library has an unsupported format.'); }
        const ids = new Set<string>();

        for (const scene of library.scenes) {
          validateScene(scene);
          if (ids.has(scene.id)) { throw new Error('The local scene library contains duplicate scene IDs.'); }
          ids.add(scene.id);
        }
        for (const scene of library.scenes) {
          // A retry or another editor tab must not replace newer IndexedDB data.
          if (await requestResult(tx.objectStore(SCENES).getKey(scene.id)) !== undefined) { continue; }
          tx.objectStore(SCENES).put(scene);
          tx.objectStore(METADATA).put(metadata(scene));
        }
        if (library.lastSceneId && ids.has(library.lastSceneId) && !await requestResult(workspace.get(LAST_SCENE))) {
          workspace.put({ key: LAST_SCENE, value: library.lastSceneId });
        }
      }
      workspace.put({ key: MIGRATED, value: true });
    });

    // Never delete the only copy until the entire migration transaction commits.
    if (legacy !== null) {
      try {
        if (window.localStorage.getItem(this.legacyKey) === legacy) { window.localStorage.removeItem(this.legacyKey); }
      } catch (error) { console.warn('The scene library was migrated, but its old local storage copy could not be removed.', error); }
    }
  }
}
