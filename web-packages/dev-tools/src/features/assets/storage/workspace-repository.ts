import { EditorDatabase } from '../../../platform/browser-storage/editor-database';
import type { ProjectRecord, ProjectSettings } from '../../projects/project-types';
import { ProjectRepository } from '../../projects/storage/project-repository';
import type { AssetBrowserPreferences, AssetEntry, AssetPayload } from '../model/asset-types';
import { AssetRepository } from './asset-repository';
import type { AssetStores } from './asset-stores';
import { WorkspaceMigrations } from './workspace-migrations';

type Listener = (entries: AssetEntry[]) => void;

export class WorkspaceRepository {
  readonly assets: AssetRepository;
  readonly projectRecords: ProjectRepository;
  private readonly connection: EditorDatabase;
  private readonly migrations: WorkspaceMigrations;
  private initialization?: Promise<void>;
  private listeners = new Set<Listener>();
  private projectListeners = new Set<() => void>();
  private channel?: BroadcastChannel;

  constructor (private readonly databaseName = 'effects-editor', legacySceneKey = 'effects-editor.scenes.v1', legacyContentName = 'effects-editor-content') {
    this.migrations = new WorkspaceMigrations(databaseName, legacySceneKey, legacyContentName);
    this.connection = new EditorDatabase(databaseName, 3, (...args) => this.migrations.upgrade(...args), () => { this.initialization = undefined; });
    this.projectRecords = new ProjectRepository(() => this.database(), () => this.notifyProjects());
    this.assets = new AssetRepository(() => this.database(), () => this.projectId, () => this.initialize(), entries => this.notify(entries),
      project => { if (project.id === this.projectId) { this.projectRecords.current = project; } }, () => this.notifyProjects());
  }

  get projectId (): string { return this.projectRecords.projectId; }
  get project (): ProjectRecord | undefined { return this.projectRecords.current; }

  subscribe (listener: Listener): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  subscribeProjects (listener: () => void): () => void {
    this.projectListeners.add(listener);

    return () => this.projectListeners.delete(listener);
  }

  initialize (): Promise<void> {
    this.initialization ??= (async () => {
      const database = await this.connection.open();

      await this.migrations.run(database); await this.projectRecords.initialize(database);
      if (typeof BroadcastChannel !== 'undefined' && !this.channel) {
        this.channel = new BroadcastChannel(this.databaseName + '.assets');
        this.channel.onmessage = event => {
          const entries = event.data?.entries;

          if (Array.isArray(entries) && entries.every(entry => entry && typeof entry.id === 'string' && ['folder', 'texture', 'scene'].includes(entry.kind))) { this.notify(entries, false); }
          if (event.data?.projects) { void this.projectRecords.getProject(this.projectId).then(project => { this.projectRecords.current = project; this.notifyProjects(false); }); }
        };
      }
    })().catch(error => { this.initialization = undefined; throw error; });

    return this.initialization;
  }

  async close (): Promise<void> {
    await this.initialization?.catch(() => {});
    this.channel?.close(); this.channel = undefined; this.connection.close(); this.initialization = undefined;
  }

  private async database (): Promise<IDBDatabase> {
    await this.initialize();

    return this.connection.open();
  }

  private notify (entries: AssetEntry[], broadcast = true): void {
    this.listeners.forEach(listener => { try { listener(entries); } catch (error) { console.error('The asset view could not be refreshed:', error); } });
    if (broadcast) { this.channel?.postMessage({ entries }); }
  }

  private notifyProjects (broadcast = true): void {
    this.projectListeners.forEach(listener => { try { listener(); } catch (error) { console.error('The project view could not be refreshed:', error); } });
    if (broadcast) { this.channel?.postMessage({ projects: true }); }
  }

  list (projectId?: string) { return this.assets.list(projectId); }
  entry (id: string, projectId?: string) { return this.assets.entry(id, projectId); }
  payload (id: string, projectId?: string) { return this.assets.payload(id, projectId); }
  preferences (projectId?: string) { return this.assets.preferences(projectId); }
  image (id: string, projectId?: string) { return this.assets.image(id, projectId); }
  setting<T> (key: string, projectId?: string) { return this.assets.setting<T>(key, projectId); }
  mutate (action: (stores: AssetStores) => AssetEntry[] | Promise<AssetEntry[]>, projectId?: string) { return this.assets.mutate(action, projectId); }
  write (entries: AssetEntry[], payloads: AssetPayload[] = [], preferences?: AssetBrowserPreferences, projectId = this.projectId) { return this.assets.write(entries, payloads, preferences, projectId); }
  projects () { return this.projectRecords.projects(); }
  getProject (id: string) { return this.projectRecords.getProject(id); }
  activateProject (id: string) { return this.projectRecords.activateProject(id); }
  createProject (project: ProjectRecord, entries: AssetEntry[], payloads: AssetPayload[], preferences?: AssetBrowserPreferences, lastSceneId?: string) { return this.projectRecords.createProject(project, entries, payloads, preferences, lastSceneId); }
  saveProjectSettings (id: string, settings: ProjectSettings) { return this.projectRecords.saveProjectSettings(id, settings); }
  trashProject (id: string, restore = false) { return this.projectRecords.trashProject(id, restore); }
  snapshotProject (id = this.projectId) { return this.projectRecords.snapshotProject(id); }
}

export const workspaceRepository = new WorkspaceRepository();
