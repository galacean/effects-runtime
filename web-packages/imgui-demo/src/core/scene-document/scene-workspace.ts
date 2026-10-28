import { generateGUID } from '@galacean/effects';
import type { Composition, Scene, VFXItem, spec } from '@galacean/effects';
import { SceneDocument } from './scene-document';
import { SceneStorage } from './scene-storage';
import type { SceneMetadata, StoredScene } from './scene-storage';
import { jsonData } from './scene-values';
import { isTextComponent } from './scene-serializer';
import { createEmptyScene } from './scene-template';

type OpenRequest = { source: Scene.LoadType, stored?: StoredScene, created?: boolean };
type Loader = (source: Scene.LoadType) => Promise<{ composition: Composition, source: spec.JSONScene }>;

export class SceneWorkspace {
  current?: SceneDocument;
  scenes: SceneMetadata[] = [];
  loadingScenes = false;
  error = '';
  dialog: '' | 'open' | 'save' | 'unsaved' | 'replace' = '';
  nameBuffer: [string] = [''];
  flushEdits: () => void = () => {};
  onRestored: () => void = () => {};
  private loader?: Loader;
  private pending?: OpenRequest;
  private replacement?: SceneMetadata;
  private requests = Promise.resolve();
  private opening = false;
  private openedSourceURL?: string;
  private saveRequest?: Promise<boolean>;

  constructor (readonly storage = new SceneStorage()) { }

  get busy (): boolean { return this.opening || !!this.saveRequest; }
  get sourceURL (): string | undefined { return this.current ? this.openedSourceURL : undefined; }

  async initialize (loader: Loader): Promise<StoredScene | undefined> {
    this.loader = loader;
    try { return await this.storage.last(); } catch (error) { this.report(error); }
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
    await this.saveRequest;
    if (this.opening) { return; }
    if (this.current && !request.created && !request.stored && typeof request.source === 'string' && request.source === this.sourceURL) { return; }
    this.flushEdits();
    this.current?.commit();
    if (this.current?.dirty) {
      this.pending = request; this.dialog = 'unsaved';

      return;
    }
    await this.open(request);
  }

  async openSaved (entry: SceneMetadata): Promise<void> {
    try {
      const stored = await this.storage.get(entry.id);

      if (!stored) { throw new Error('This scene is no longer in the local library. Refresh the scene list and try again.'); }
      await this.requestOpen(jsonData(stored.scene), stored);
    } catch (error) { this.report(error); }
  }

  private async open (request: OpenRequest): Promise<void> {
    this.opening = true;
    this.requests = this.requests.then(async () => {
      try {
        const loaded = await this.loader!(request.source);
        const document = new SceneDocument(loaded.composition, loaded.source, request.stored?.editor);

        this.current?.dispose();
        document.beforeSelectionChange = () => this.flushEdits();
        document.onRestored = () => this.onRestored();
        this.current = document;
        this.openedSourceURL = typeof request.source === 'string' ? request.source : undefined;
        // Existing source data is the initial baseline even when it has no local library entry.
        if (!request.created) { document.markSaved(); }
        if (request.stored) {
          document.storageId = request.stored.id; document.name = request.stored.name;
          await this.storage.select(request.stored.id);
        }
      } catch (error) { this.report(error); } finally { this.opening = false; }
    });
    await this.requests;
  }

  showSaveAs (): void {
    if (!this.current || this.busy) { return; }
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
      const existing = await this.storage.findByName(name);

      if (existing && existing.id !== document.storageId) {
        this.replacement = existing; this.dialog = 'replace';

        return false;
      }

      return this.write(document, existing?.id ?? generateGUID(), name);
    });
  }

  replace (): Promise<boolean> {
    const document = this.current;
    const replacement = this.replacement;

    if (!document || !replacement || this.busy) { return Promise.resolve(false); }

    return this.startSave(() => this.write(document, replacement.id, this.nameBuffer[0].trim()));
  }

  private startSave (operation: () => Promise<boolean>): Promise<boolean> {
    this.saveRequest = Promise.resolve().then(operation).catch(error => {
      this.report(error);

      return false;
    }).finally(() => { this.saveRequest = undefined; });

    return this.saveRequest;
  }

  private async write (document: SceneDocument, id: string, name: string): Promise<boolean> {
    this.flushEdits();
    document.commit(true); document.validate();
    const snapshot = document.snapshot();
    const revision = document.revision;
    const updatedAt = Date.now();

    await this.storage.save({ id, name, updatedAt, ...snapshot });
    document.storageId = id; document.name = name; document.markSaved(revision);
    this.scenes = [{ id, name, updatedAt }, ...this.scenes.filter(entry => entry.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
    this.dialog = '';
    if (this.pending) {
      // Edits made while the transaction was pending still need the user's decision.
      if (document.dirty) { this.dialog = 'unsaved'; } else { this.discardAndOpen(); }
    }

    return true;
  }

  discardAndOpen (): void {
    const request = this.pending;

    this.pending = undefined; this.dialog = '';
    if (request) { void this.open(request); }
  }

  cancelOpen (): void { this.pending = undefined; this.dialog = ''; }

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
      if (source.options.height !== undefined) { before.data.options.height = source.options.height; }
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
