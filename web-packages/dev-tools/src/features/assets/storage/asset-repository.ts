import { requestResult, runTransaction as transaction } from '../../../platform/browser-storage/indexeddb';
import type { ProjectRecord } from '../../projects/project-types';
import type { AssetBrowserPreferences, AssetEntry, AssetImage, AssetPayload } from '../model/asset-types';
import type { AssetStores } from './asset-stores';
import { validateAssetWrite } from './asset-write-validation';
import { WORKSPACE_STORES as STORES } from './workspace-schema';

export class AssetRepository {
  constructor (private readonly database: () => Promise<IDBDatabase>, private readonly currentProjectId: () => string,
    private readonly ensureInitialized: () => Promise<void>, private readonly notify: (entries: AssetEntry[]) => void,
    private readonly updateProject: (project: ProjectRecord) => void, private readonly notifyProjects: () => void) { }

  get projectId (): string { return this.currentProjectId(); }

  private async read<T> (store: string, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.database();

    return transaction(database, [store], 'readonly', tx => requestResult(action(tx.objectStore(store))));
  }

  async list (projectId?: string): Promise<AssetEntry[]> {
    await this.ensureInitialized();

    return this.read('assets', store => store.index('projectId').getAll(projectId ?? this.projectId));
  }

  async entry (id: string, projectId?: string): Promise<AssetEntry | undefined> {
    await this.ensureInitialized(); projectId ??= this.projectId;
    const entry = await this.read<AssetEntry | undefined>('assets', store => store.get(id));

    return entry?.projectId === projectId ? entry : undefined;
  }

  async payload (id: string, projectId?: string): Promise<AssetPayload | undefined> {
    const database = await this.database();

    projectId ??= this.projectId;

    return transaction(database, ['assets', 'assetData'], 'readonly', async tx => {
      const entry = await requestResult<AssetEntry | undefined>(tx.objectStore('assets').get(id));

      return entry?.projectId === projectId ? requestResult<AssetPayload | undefined>(tx.objectStore('assetData').get(id)) : undefined;
    });
  }

  async preferences (projectId?: string): Promise<AssetBrowserPreferences | undefined> {
    await this.ensureInitialized();

    return this.read('preferences', store => store.get(projectId ?? this.projectId));
  }

  async image (id: string, projectId?: string): Promise<AssetImage | undefined> {
    const payload = await this.payload(id, projectId);

    return payload?.kind === 'texture' ? payload : undefined;
  }

  async setting<T> (key: string, projectId?: string): Promise<T | undefined> {
    await this.ensureInitialized();

    return (await this.read('workspace', store => store.get((projectId ?? this.projectId) + ':' + key)))?.value;
  }

  async mutate (action: (stores: AssetStores) => AssetEntry[] | Promise<AssetEntry[]>, projectId?: string): Promise<void> {
    const database = await this.database();

    projectId ??= this.projectId;
    let updatedProject: ProjectRecord | undefined;
    const scope = projectId;
    const entries = await transaction(database, STORES, 'readwrite', async tx => {
      const projects = tx.objectStore('projects'), project = await requestResult<ProjectRecord | undefined>(projects.get(scope));

      if (!project || project.deletedAt) { throw new Error('This project is no longer available.'); }
      const changes = await action({ projectId: scope, entries: tx.objectStore('assets'), payloads: tx.objectStore('assetData'), preferences: tx.objectStore('preferences'), workspace: tx.objectStore('workspace') });

      if (changes.some(entry => entry.projectId !== scope)) { throw new Error('Assets can only be edited in their own project.'); }
      if (changes.length) {
        updatedProject = { ...project, updatedAt: Date.now(), startupSceneId: changes.some(entry => entry.id === project.startupSceneId && entry.deletedAt) ? undefined : project.startupSceneId };
        projects.put(updatedProject);
      }

      return changes;
    });

    if (entries.length) {
      if (updatedProject) { this.updateProject(updatedProject); }
      this.notify(entries); this.notifyProjects();
    }
  }

  async write (entries: AssetEntry[], payloads: AssetPayload[] = [], preferences?: AssetBrowserPreferences, projectId = this.projectId): Promise<void> {
    await this.mutate(async stores => {
      await validateAssetWrite(stores, entries, payloads);
      entries.forEach(entry => stores.entries.put(entry)); payloads.forEach(payload => stores.payloads.put(payload));
      if (preferences) { stores.preferences.put(preferences, projectId); }

      return entries;
    }, projectId);
  }
}
