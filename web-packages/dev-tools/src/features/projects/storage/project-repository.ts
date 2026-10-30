import { requestResult, runTransaction as transaction } from '../../../platform/browser-storage/indexeddb';
import type { AssetBrowserPreferences, AssetEntry, AssetPayload } from '../../assets/model/asset-types';
import { WORKSPACE_STORES as STORES } from '../../assets/storage/workspace-schema';
import type { ProjectRecord, ProjectSettings } from '../project-types';
import { DEFAULT_PROJECT_ID } from '../project-types';

export class ProjectRepository {
  current?: ProjectRecord;

  constructor (private readonly database: () => Promise<IDBDatabase>, private readonly notifyProjects: () => void) { }

  get projectId (): string { return this.current?.id ?? DEFAULT_PROJECT_ID; }

  async initialize (database: IDBDatabase): Promise<void> {
    await transaction(database, ['workspace', 'projects'], 'readwrite', async tx => {
      const last = await requestResult(tx.objectStore('workspace').get('lastProjectId'));
      const selected = await requestResult<ProjectRecord | undefined>(tx.objectStore('projects').get(last?.value ?? DEFAULT_PROJECT_ID));
      const project = selected && !selected.deletedAt ? selected : await requestResult<ProjectRecord>(tx.objectStore('projects').get(DEFAULT_PROJECT_ID));

      this.current = { ...project, lastOpenedAt: Date.now() }; tx.objectStore('projects').put(this.current);
    });
  }

  private async read<T> (store: string, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.database();

    return transaction(database, [store], 'readonly', tx => requestResult(action(tx.objectStore(store))));
  }

  async projects (): Promise<ProjectRecord[]> { return this.read('projects', store => store.getAll()); }

  async getProject (id: string): Promise<ProjectRecord | undefined> { return this.read('projects', store => store.get(id)); }

  private async refreshProject (): Promise<void> {
    if (this.current) { this.current = await this.getProject(this.current.id); }
  }

  async activateProject (id: string): Promise<void> {
    const database = await this.database();
    const project = await transaction(database, ['projects', 'workspace'], 'readwrite', async tx => {
      const project = await requestResult<ProjectRecord | undefined>(tx.objectStore('projects').get(id));

      if (!project || project.deletedAt) { throw new Error('This project is no longer available.'); }
      const next = { ...project, lastOpenedAt: Date.now() };

      tx.objectStore('projects').put(next); tx.objectStore('workspace').put({ key: 'lastProjectId', value: id });

      return next;
    });

    this.current = project; this.notifyProjects();
  }

  async createProject (project: ProjectRecord, entries: AssetEntry[], payloads: AssetPayload[], preferences?: AssetBrowserPreferences, lastSceneId?: string): Promise<void> {
    const database = await this.database();

    await transaction(database, STORES, 'readwrite', async tx => {
      if (await requestResult(tx.objectStore('projects').getKey(project.id)) !== undefined) { throw new Error('This project ID is already in use.'); }
      const existing = await requestResult<ProjectRecord[]>(tx.objectStore('projects').getAll());

      if (existing.some(entry => !entry.deletedAt && entry.name.toLowerCase() === project.name.toLowerCase())) { throw new Error('A project with that name already exists.'); }
      for (const entry of entries) {
        if (entry.projectId !== project.id || await requestResult(tx.objectStore('assets').getKey(entry.id)) !== undefined) { throw new Error('The project contains a conflicting asset ID.'); }
      }
      tx.objectStore('projects').put(project);
      entries.forEach(entry => tx.objectStore('assets').put(entry)); payloads.forEach(payload => tx.objectStore('assetData').put(payload));
      if (preferences) { tx.objectStore('preferences').put(preferences, project.id); }
      if (lastSceneId) {
        const key = project.id + ':lastSceneId';

        tx.objectStore('workspace').put({ key, value: lastSceneId });
      }
    });
    this.notifyProjects();
  }

  async saveProjectSettings (id: string, settings: ProjectSettings): Promise<void> {
    const name = settings.name.trim(), description = settings.description.trim();

    if (!name || name.length > 80) { throw new Error('Enter a project name with 1–80 characters.'); }
    if (description.length > 4096) { throw new Error('The project description is too long.'); }
    const database = await this.database();

    await transaction(database, ['projects', 'assets'], 'readwrite', async tx => {
      const projects = tx.objectStore('projects');
      const current = await requestResult<ProjectRecord | undefined>(projects.get(id));
      const all = await requestResult<ProjectRecord[]>(projects.getAll());

      if (!current || current.deletedAt) { throw new Error('This project is no longer available.'); }
      if (all.some(project => project.id !== id && !project.deletedAt && project.name.toLowerCase() === name.toLowerCase())) { throw new Error('A project with that name already exists.'); }
      if (settings.startupSceneId) {
        const scene = await requestResult<AssetEntry | undefined>(tx.objectStore('assets').get(settings.startupSceneId));

        if (scene?.projectId !== id || scene.kind !== 'scene' || scene.deletedAt) { throw new Error('Choose a scene from this project.'); }
      }
      projects.put({ ...current, name, description, startupSceneId: settings.startupSceneId, updatedAt: Date.now() });
    });
    await this.refreshProject(); this.notifyProjects();
  }

  async trashProject (id: string, restore = false): Promise<void> {
    if (!restore && id === this.projectId) { throw new Error('Open another project before deleting this one.'); }
    const database = await this.database();

    await transaction(database, ['projects'], 'readwrite', async tx => {
      const store = tx.objectStore('projects'), project = await requestResult<ProjectRecord | undefined>(store.get(id));

      if (!project) { throw new Error('This project is no longer available.'); }
      const projects = await requestResult<ProjectRecord[]>(store.getAll());
      let name = project.name, suffix = 1;

      if (restore) { while (projects.some(other => other.id !== id && !other.deletedAt && other.name.toLowerCase() === name.toLowerCase())) { name = project.name + '_' + suffix++; } }
      store.put({ ...project, name, deletedAt: restore ? undefined : Date.now(), updatedAt: Date.now() });
    });
    this.notifyProjects();
  }

  async snapshotProject (id = this.projectId): Promise<{ project: ProjectRecord, entries: AssetEntry[], payloads: AssetPayload[], preferences?: AssetBrowserPreferences, lastSceneId?: string }> {
    const database = await this.database();

    return transaction(database, STORES, 'readonly', async tx => {
      const project = await requestResult<ProjectRecord | undefined>(tx.objectStore('projects').get(id));

      if (!project || project.deletedAt) { throw new Error('This project is no longer available.'); }
      const entries = await requestResult<AssetEntry[]>(tx.objectStore('assets').index('projectId').getAll(id));
      const payloads = await Promise.all(entries.filter(entry => entry.kind !== 'folder').map(entry => requestResult<AssetPayload | undefined>(tx.objectStore('assetData').get(entry.id))));
      const preferences = await requestResult<AssetBrowserPreferences | undefined>(tx.objectStore('preferences').get(id));
      const last = await requestResult(tx.objectStore('workspace').get(id + ':lastSceneId'));

      if (payloads.some(payload => !payload)) { throw new Error('A project asset is missing. The project could not be exported.'); }

      return { project, entries, payloads: payloads as AssetPayload[], preferences, lastSceneId: last?.value };
    });
  }
}
