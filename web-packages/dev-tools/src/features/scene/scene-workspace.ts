import type { Composition, Scene, VFXItem, spec } from '@galacean/effects';
import { generateGUID } from '@galacean/effects';
import { assetLibrary } from '../assets/asset-library';
import { ASSET_ROOT } from '../assets/model/asset-types';
import { SceneDocument } from './document/scene-document';
import type { SceneMetadata, StoredScene } from './document/scene-types';
import { createEmptyScene } from './factories/scene-template';
import { isTextComponent } from './serialization/scene-serializer';
import { jsonData } from './serialization/scene-values';
import { SceneRepository } from './storage/scene-repository';

type OpenRequest = { source: Scene.LoadType, stored?: StoredScene, created?: boolean };
type Loader = (source: Scene.LoadType) => Promise<{ composition: Composition, source: spec.JSONScene }>;

export class SceneWorkspace {
  current?: SceneDocument;
  scenes: SceneMetadata[] = [];
  loadingScenes = false;
  error = '';
  dialog: '' | 'open' | 'save' | 'unsaved' | 'replace' = '';
  nameBuffer: [string] = [''];
  saveFolder = ASSET_ROOT;
  flushEdits: () => void = () => {};
  onRestored: () => void = () => {};
  private loader?: Loader;
  private pending?: { run: () => Promise<void>, description: string };
  private afterSave?: () => Promise<void>;
  private transitioning = false;
  private documentProjectId = '';
  private replacement?: SceneMetadata;
  private requests = Promise.resolve();
  private opening = false;
  private openedSourceURL?: string;
  private saveRequest?: Promise<boolean>;

  constructor (readonly storage = new SceneRepository()) {
    storage.subscribe(entries => {
      for (const entry of entries.filter(entry => entry.kind === 'scene' && entry.projectId === storage.assets.projectId)) {
        this.scenes = this.scenes.filter(scene => scene.id !== entry.id);
        if (!entry.deletedAt) { this.scenes.push({ id: entry.id, name: entry.name, updatedAt: entry.updatedAt, parentId: entry.parentId }); }
        if (this.current?.storageId === entry.id) {
          this.current.name = entry.name;
          if (entry.deletedAt) { this.current.storageId = undefined; this.current.markUnsaved(); }
        }
      }
      this.scenes.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }

  get busy (): boolean { return this.opening || this.transitioning || !!this.saveRequest; }
  get changingDocument (): boolean { return this.opening || this.transitioning; }
  get pendingDescription (): string { return this.pending?.description ?? 'opening another scene'; }
  get sourceURL (): string | undefined { return this.current ? this.openedSourceURL : undefined; }

  async initialize (loader: Loader): Promise<StoredScene | undefined> {
    this.loader = loader;
    try {
      await this.storage.initialize();
      const [scenes, last] = await Promise.all([this.storage.list(), this.storage.initial()]);

      this.scenes = scenes;

      return last;
    } catch (error) { this.report(error); }
  }

  showOpen (): void {
    if (this.busy) { return; }
    this.dialog = 'open';
    void this.refreshScenes();
  }

  async refreshScenes (): Promise<void> {
    this.loadingScenes = true;
    try { this.scenes = await this.storage.list(); } catch (error) { this.report(error); } finally { this.loadingScenes = false; }
  }

  async requestOpen (source: Scene.LoadType, stored?: StoredScene): Promise<void> {
    await this.request({ source, stored });
  }

  async newScene (): Promise<void> {
    await this.request({ source: createEmptyScene(), created: true });
  }

  private async request (request: OpenRequest): Promise<void> {
    if (this.current && !request.created && !request.stored && typeof request.source === 'string' && request.source === this.sourceURL) { return; }
    await this.requestTransition(() => this.open(request), 'opening another scene');
  }

  async requestTransition (run: () => Promise<void>, description: string): Promise<void> {
    await this.saveRequest;
    if (this.opening || this.transitioning || this.pending) { return; }
    this.flushEdits();
    this.current?.commit();
    if (this.current?.dirty) {
      this.pending = { run, description }; this.dialog = 'unsaved';

      return;
    }
    await this.runTransition(run);
  }

  private async runTransition (run: () => Promise<void>): Promise<void> {
    this.transitioning = true;
    try { await run(); } catch (error) { this.report(error); } finally { this.transitioning = false; }
  }

  async loadProject (stored?: StoredScene): Promise<void> {
    await this.refreshScenes();
    await this.open({ source: stored?.scene ?? createEmptyScene(), stored }, true);
  }

  async openSaved (entry: SceneMetadata): Promise<void> {
    if (this.current?.storageId === entry.id) { return; }
    try {
      const stored = await this.storage.get(entry.id);

      if (!stored) { throw new Error('This scene is no longer in the local library. Refresh the scene list and try again.'); }
      await this.requestOpen(jsonData(stored.scene), stored);
    } catch (error) { this.report(error); }
  }

  private async open (request: OpenRequest, propagate = false): Promise<void> {
    this.opening = true;
    this.requests = this.requests.catch(() => {}).then(async () => {
      try {
        const loaded = await this.loader!(request.source);
        const document = new SceneDocument(loaded.composition, loaded.source, request.stored?.editor);

        this.current?.dispose();
        document.beforeSelectionChange = () => this.flushEdits();
        document.onRestored = () => this.onRestored();
        this.current = document;
        this.documentProjectId = this.storage.assets.projectId;
        this.openedSourceURL = typeof request.source === 'string' ? request.source : undefined;
        // Existing source data is the initial baseline even when it has no local library entry.
        if (!request.created) { document.markSaved(); }
        if (request.stored) {
          document.storageId = request.stored.id || undefined; document.name = request.stored.name;
          if (request.stored.id) { await this.storage.select(request.stored.id); }
        }
        this.onRestored();
      } catch (error) { this.report(error); if (propagate) { throw error; } } finally { this.opening = false; }
    });
    await this.requests;
  }

  showSaveAs (folder?: string): void {
    if (!this.current || this.busy) { return; }
    this.saveFolder = folder ?? assetLibrary.entry(this.current.storageId ?? '')?.parentId ?? assetLibrary.preferences.folder;
    this.nameBuffer[0] = this.current.name; this.dialog = 'save';
  }

  save (saveAs = false): Promise<boolean> {
    const document = this.current;

    if (!document || this.busy) { return Promise.resolve(false); }
    if (saveAs || !document.storageId) {
      this.showSaveAs();

      return Promise.resolve(false);
    }

    const id = document.storageId;

    return this.startSave(() => this.write(document, id, document.name));
  }

  saveAs (): Promise<boolean> {
    const document = this.current;
    const name = this.nameBuffer[0].trim();

    if (!name || !document || this.busy) { return Promise.resolve(false); }

    return this.startSave(async () => {
      const existing = await this.storage.findByName(name, this.saveFolder);

      if (existing && existing.id !== document.storageId) {
        this.replacement = existing; this.dialog = 'replace';

        return false;
      }

      return this.write(document, existing?.id ?? generateGUID(), name, this.saveFolder);
    });
  }

  async saveAll (after?: () => Promise<void>): Promise<void> {
    if (this.busy) { return; }
    this.flushEdits(); this.current?.commit(true);
    if (this.current && !this.current.storageId) {
      this.afterSave = async () => { await assetLibrary.saveAll(); await after?.(); };
      this.showSaveAs();

      return;
    }
    if (this.current?.dirty && !await this.save()) { return; }
    await assetLibrary.whenIdle(); await assetLibrary.saveAll(); await after?.();
  }

  replace (): Promise<boolean> {
    const document = this.current;
    const replacement = this.replacement;

    if (!document || !replacement || this.busy) { return Promise.resolve(false); }

    return this.startSave(() => this.write(document, replacement.id, this.nameBuffer[0].trim(), this.saveFolder));
  }

  private startSave (operation: () => Promise<boolean>): Promise<boolean> {
    this.saveRequest = Promise.resolve().then(operation).catch(error => {
      this.report(error);

      return false;
    }).finally(() => { this.saveRequest = undefined; });

    return this.saveRequest;
  }

  private async write (document: SceneDocument, id: string, name: string, folder?: string): Promise<boolean> {
    this.flushEdits();
    document.commit(true); document.validate();
    const snapshot = document.snapshot();
    const revision = document.revision;
    const updatedAt = Date.now();

    await this.storage.save({ id, projectId: this.documentProjectId, name, updatedAt, ...snapshot }, folder);
    document.storageId = id; document.name = name; document.markSaved(revision);
    this.scenes = [{ id, name, updatedAt, parentId: assetLibrary.entry(id)?.parentId }, ...this.scenes.filter(entry => entry.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
    this.dialog = '';
    const afterSave = this.afterSave;

    this.afterSave = undefined;
    await afterSave?.();
    if (this.pending) {
      // Edits made while the transaction was pending still need the user's decision.
      if (document.dirty) { this.dialog = 'unsaved'; } else { this.discardAndOpen(); }
    }

    return true;
  }

  discardAndOpen (): void {
    const request = this.pending;

    this.pending = undefined; this.dialog = '';
    if (request) { void this.runTransition(request.run); }
  }

  cancelOpen (): void { this.pending = undefined; this.afterSave = undefined; this.dialog = ''; }

  changeSelection (apply: () => void): void {
    if (this.current && !this.opening) { this.current.changeSelection(apply); } else { apply(); }
  }

  undo (): void { this.applyHistory(false); }

  redo (): void { this.applyHistory(true); }

  private applyHistory (redo: boolean): void {
    if (this.busy || !this.current) { return; }
    try {
      this.flushEdits();
      if (redo) { this.current.redo(); } else { this.current.undo(); }
      if (this.current.history.resetReason) { this.error = this.current.history.resetReason; }
    } catch (error) { this.report(error); }
  }

  observe (label: string, action: () => void, targets?: unknown[]): boolean {
    if (!this.current || this.opening) {
      action();

      return false;
    }
    try { return this.current.observe(label, action, targets); } catch (error) { this.report(error); }

    return false;
  }

  recordText (item: VFXItem): void {
    const document = this.current;

    if (!document) { return; }
    for (const component of item.components) {
      if (!isTextComponent(component)) { continue; }
      const after = document.serializer.read(component);
      const source = document.scene.components.find(entry => entry.id === after.data.id) as any;

      if (!source) { continue; }
      const before = { ...after, data: jsonData(after.data) };

      before.data.options.text = source.options.text;
      if (source.options.textHeight !== undefined) { before.data.options.textHeight = source.options.textHeight; }
      document.recordObject('Edit text', before, after);
    }
  }

  report (error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      this.error = 'Browser storage is full. Your edits remain in memory and the previous save is unchanged.';
    }
    console.error('Scene operation failed:', error);
  }
}

export const sceneWorkspace = new SceneWorkspace();
