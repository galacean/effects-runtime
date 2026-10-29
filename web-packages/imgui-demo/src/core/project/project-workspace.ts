import { generateGUID } from '@galacean/effects';
import { assetStorage } from '../asset-database/asset-storage';
import { ASSET_ROOT } from '../asset-database/asset-types';
import { contentLibrary } from '../content-library/content-library';
import { sceneWorkspace } from '../scene-document/scene-workspace';
import type { StoredScene } from '../scene-document/scene-storage';
import { createEmptyScene } from '../scene-document/scene-template';
import type { ProjectRecord, ProjectSettings } from './project-types';
import { decodeProject, encodeProject } from './project-package';

class ProjectWorkspace {
  projects: ProjectRecord[] = [];
  ready = false;
  busy = false;
  error = '';
  revision = 0;
  status = '';
  private statusTime = 0;
  private initialization?: Promise<void>;
  private picker?: HTMLInputElement;

  constructor () { assetStorage.subscribeProjects(() => { void this.refresh(); }); }

  get current (): ProjectRecord | undefined { return assetStorage.project; }
  get notice (): string { return Date.now() - this.statusTime < 4000 ? this.status : ''; }
  get recent (): ProjectRecord[] { return this.projects.filter(project => !project.deletedAt).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 10); }

  initialize (): Promise<void> {
    this.initialization ??= (async () => { await assetStorage.initialize(); await contentLibrary.initialize(); await this.refresh(); this.ready = true; })();

    return this.initialization;
  }

  async refresh (): Promise<void> {
    this.projects = await assetStorage.projects(); this.revision++;
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

      await assetStorage.createProject(project, [{ id: sceneId, projectId: id, parentId: ASSET_ROOT, name: 'Main', kind: 'scene', createdAt: now, updatedAt: now }],
        [{ id: sceneId, kind: 'scene', scene, editor: { objects: {} } }]);
      await this.activate(id);
    }), 'creating another project');
  }

  private async activate (id: string): Promise<void> {
    const project = await assetStorage.getProject(id);

    if (!project || project.deletedAt) { throw new Error('This project is no longer available.'); }
    const stored = await sceneWorkspace.storage.initial(id);
    const previous = sceneWorkspace.current, previousId = assetStorage.projectId, dirty = previous?.dirty;
    const backup: StoredScene | undefined = previous ? { id: previous.storageId ?? '', projectId: previousId, name: previous.name, updatedAt: Date.now(), ...previous.snapshot() } : undefined;

    await contentLibrary.whenIdle(); await contentLibrary.savePreferences();
    try {
      await assetStorage.activateProject(id); await contentLibrary.reloadProject();
      await sceneWorkspace.loadProject(stored);
    } catch (error) {
      await assetStorage.activateProject(previousId); await contentLibrary.reloadProject();
      if (sceneWorkspace.current !== previous) { await sceneWorkspace.loadProject(backup); } else { await sceneWorkspace.refreshScenes(); }
      if (dirty) { sceneWorkspace.current?.markUnsaved(); }
      sceneWorkspace.error = '';
      throw error;
    }
    await this.refresh();
  }

  async settings (settings: ProjectSettings): Promise<void> {
    const id = this.current?.id;

    if (id) { await this.operation(() => assetStorage.saveProjectSettings(id, settings)); }
  }

  async trash (id: string, restore = false): Promise<void> { await this.operation(() => assetStorage.trashProject(id, restore)); }

  async export (): Promise<void> {
    await sceneWorkspace.saveAll(() => this.operation(async () => {
      const snapshot = await assetStorage.snapshotProject();
      const blob = await encodeProject(snapshot), url = URL.createObjectURL(blob), link = document.createElement('a');

      link.href = url; link.download = snapshot.project.name.replace(/[/\\:*?"<>|]/g, '_') + '.geproject';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      this.status = 'Project exported'; this.statusTime = Date.now();
    }));
  }

  chooseImport (): void {
    this.picker ??= document.createElement('input');
    this.picker.type = 'file'; this.picker.accept = '.geproject,application/json';
    this.picker.onchange = () => {
      const file = this.picker?.files?.[0];

      if (file) { void this.import(file); }
      this.picker!.value = '';
    };
    this.picker.click();
  }

  async import (file: File): Promise<void> {
    await sceneWorkspace.requestTransition(() => this.operation(async () => {
      const snapshot = await decodeProject(file, this.projects.filter(project => !project.deletedAt).map(project => project.name));

      await assetStorage.createProject(snapshot.project, snapshot.entries, snapshot.payloads, snapshot.preferences, snapshot.lastSceneId);
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
