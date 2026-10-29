import { generateGUID } from '@galacean/effects';
import { BrowserFilePicker, downloadBlob } from '../../platform/browser-files/file-dialog';
import { assetLibrary } from '../assets/asset-library';
import { ASSET_ROOT } from '../assets/model/asset-types';
import { workspaceRepository } from '../assets/storage/workspace-repository';
import type { StoredScene } from '../scene/document/scene-types';
import { createEmptyScene } from '../scene/factories/scene-template';
import { sceneWorkspace } from '../scene/scene-workspace';
import { decodeProject, encodeProject } from './project-package';
import type { ProjectRecord, ProjectSettings } from './project-types';

class ProjectWorkspace {
  projects: ProjectRecord[] = [];
  ready = false;
  busy = false;
  error = '';
  revision = 0;
  status = '';
  private statusTime = 0;
  private initialization?: Promise<void>;
  private readonly picker = new BrowserFilePicker();

  constructor () { workspaceRepository.subscribeProjects(() => { void this.refresh(); }); }

  get current (): ProjectRecord | undefined { return workspaceRepository.project; }
  get notice (): string { return Date.now() - this.statusTime < 4000 ? this.status : ''; }
  get recent (): ProjectRecord[] { return this.projects.filter(project => !project.deletedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 10); }

  initialize (): Promise<void> {
    this.initialization ??= (async () => { await workspaceRepository.initialize(); await assetLibrary.initialize(); await this.refresh(); this.ready = true; })();

    return this.initialization;
  }

  async refresh (): Promise<void> {
    this.projects = await workspaceRepository.projects(); this.revision++;
    if (typeof document !== 'undefined' && this.current) { document.title = this.current.name + ' — Effects Editor'; }
  }

  async open (id: string): Promise<void> {
    if (this.busy || id === this.current?.id) { return; }
    await sceneWorkspace.requestTransition(() => this.operation(() => this.activate(id)), 'opening another project');
  }

  async create (name: string, description: string): Promise<void> {
    name = name.trim();
    if (!name || name.length > 80) {
      this.error = 'Enter a project name with 1–80 characters.';

      return;
    }
    await sceneWorkspace.requestTransition(() => this.operation(async () => {
      const now = Date.now(), id = generateGUID(), sceneId = generateGUID();
      const project: ProjectRecord = { id, name, description: description.trim().slice(0, 4096), createdAt: now, updatedAt: now, lastOpenedAt: now, startupSceneId: sceneId };
      const scene = createEmptyScene();

      scene.compositions[0].name = 'Main';

      await workspaceRepository.createProject(project, [{ id: sceneId, projectId: id, parentId: ASSET_ROOT, name: 'Main', kind: 'scene', createdAt: now, updatedAt: now }],
        [{ id: sceneId, kind: 'scene', scene, editor: { objects: {} } }]);
      await this.activate(id);
    }), 'creating another project');
  }

  private async activate (id: string): Promise<void> {
    const project = await workspaceRepository.getProject(id);

    if (!project || project.deletedAt) { throw new Error('This project is no longer available.'); }
    const stored = await sceneWorkspace.storage.initial(id);
    const previous = sceneWorkspace.current, previousId = workspaceRepository.projectId, dirty = previous?.dirty;
    const backup: StoredScene | undefined = previous ? { id: previous.storageId ?? '', projectId: previousId, name: previous.name, updatedAt: Date.now(), ...previous.snapshot() } : undefined;

    await assetLibrary.whenIdle(); await assetLibrary.savePreferences();
    try {
      await workspaceRepository.activateProject(id); await assetLibrary.reloadProject();
      await sceneWorkspace.loadProject(stored);
    } catch (error) {
      await workspaceRepository.activateProject(previousId); await assetLibrary.reloadProject();
      if (sceneWorkspace.current !== previous) { await sceneWorkspace.loadProject(backup); } else { await sceneWorkspace.refreshScenes(); }
      if (dirty) { sceneWorkspace.current?.markUnsaved(); }
      sceneWorkspace.error = '';
      throw error;
    }
    await this.refresh();
  }

  async settings (settings: ProjectSettings): Promise<void> {
    const id = this.current?.id;

    if (id) { await this.operation(() => workspaceRepository.saveProjectSettings(id, settings)); }
  }

  async trash (id: string, restore = false): Promise<void> { await this.operation(() => workspaceRepository.trashProject(id, restore)); }

  async export (): Promise<void> {
    await sceneWorkspace.saveAll(() => this.operation(async () => {
      const snapshot = await workspaceRepository.snapshotProject();

      downloadBlob(await encodeProject(snapshot), snapshot.project.name.replace(/[/\\:*?"<>|]/g, '_') + '.geproject');
      this.status = 'Project exported'; this.statusTime = Date.now();
    }));
  }

  chooseImport (): void { this.picker.choose('.geproject,application/json', files => { void this.import(files[0]); }); }

  async import (file: File): Promise<void> {
    await sceneWorkspace.requestTransition(() => this.operation(async () => {
      const snapshot = await decodeProject(file, this.projects.filter(project => !project.deletedAt).map(project => project.name));

      await workspaceRepository.createProject(snapshot.project, snapshot.entries, snapshot.payloads, snapshot.preferences, snapshot.lastSceneId);
      await this.activate(snapshot.project.id);
    }), 'opening the imported project');
  }

  private async operation (run: () => Promise<void>): Promise<void> {
    if (this.busy) { return; }
    this.busy = true; this.error = '';
    try { await run(); } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      console.error('Project operation failed:', error);
    } finally { this.busy = false; }
  }
}

export const projectWorkspace = new ProjectWorkspace();
