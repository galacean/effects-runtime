import type { Engine, Texture } from '@galacean/effects';
import { generateGUID } from '@galacean/effects';
import { createEmptyScene } from '../scene/factories/scene-template';
import { createImageThumbnail, decodeImage } from './importers/image-importer';
import type { AssetBrowserPreferences, AssetEntry, AssetPayload } from './model/asset-types';
import { ASSET_ROOT } from './model/asset-types';
import { assertUniqueAssetName, contentAssetName } from './model/asset-validation';
import { AssetTextureCache } from './runtime/asset-texture-cache';
import { workspaceRepository } from './storage/workspace-repository';

const DEFAULTS: AssetBrowserPreferences = {
  folder: ASSET_ROOT, view: 'tiles', thumbnailSize: 96, sourcesWidth: 216, sources: true,
  showFolders: true, recursive: true, sort: 'name', descending: false, collections: [],
};

export class AssetLibrary {
  readonly storage = workspaceRepository;
  projectId = '';
  entries: AssetEntry[] = [];
  preferences: AssetBrowserPreferences = { ...DEFAULTS, collections: [] };
  ready = false;
  busy = false;
  progress = '';
  error = '';
  revision = 0;
  private status = '';
  private statusTime = 0;
  private initialization?: Promise<void>;
  private requests = Promise.resolve();
  private readonly textureCache = new AssetTextureCache({
    projectId: () => this.projectId,
    entry: id => this.entry(id),
    image: (id, projectId) => this.storage.image(id, projectId),
  });
  private pendingEntries = new Map<string, AssetEntry>();

  constructor () {
    this.storage.subscribe(entries => {
      const scoped = entries.filter(entry => entry.projectId === this.projectId);

      if (!this.ready) { scoped.forEach(entry => this.pendingEntries.set(entry.id, entry)); }
      if (scoped.length) { this.mergeEntries(scoped); }
    });
  }

  private mergeEntries (entries: AssetEntry[]): void {
    const changes = new Map(entries.map(entry => [entry.id, entry]));

    this.entries = [...this.entries.filter(entry => !changes.has(entry.id)), ...entries]; this.revision++;
    entries.filter(entry => entry.kind === 'texture').forEach(entry => this.textureCache.rename(entry));
  }

  get notice (): string { return Date.now() - this.statusTime < 3500 ? this.status : ''; }
  set notice (value: string) { this.status = value; this.statusTime = Date.now(); }

  initialize (): Promise<void> {
    this.initialization ??= (async () => {
      await this.storage.initialize();
      this.projectId = this.storage.projectId;
      const [entries, preferences] = await Promise.all([this.storage.list(this.projectId), this.storage.preferences(this.projectId)]);

      this.entries = entries;
      this.mergeEntries([...this.pendingEntries.values()]); this.pendingEntries.clear();
      this.preferences = { ...DEFAULTS, ...preferences, collections: preferences?.collections ?? [] };
      if (!['tiles', 'list', 'columns'].includes(this.preferences.view)) { this.preferences.view = 'tiles'; }
      this.preferences.thumbnailSize = Math.max(48, Math.min(192, this.preferences.thumbnailSize));
      this.preferences.sourcesWidth = Math.max(140, Math.min(380, this.preferences.sourcesWidth));
      if (this.preferences.folder !== ASSET_ROOT && (this.entry(this.preferences.folder)?.kind !== 'folder' || this.entry(this.preferences.folder)?.deletedAt)) { this.preferences.folder = ASSET_ROOT; }
      this.ready = true; this.revision++;
    })().catch(error => { this.initialization = undefined; this.report(error); });

    return this.initialization;
  }

  async whenIdle (): Promise<void> { await this.requests; }

  async reloadProject (): Promise<void> {
    await this.whenIdle();
    this.ready = false; this.entries = []; this.initialization = undefined; this.pendingEntries.clear();
    this.textureCache.reset();
    this.error = ''; this.notice = '';
    await this.initialize();
    if (!this.ready) { throw new Error('The project content could not be opened.'); }
  }

  entry (id: string): AssetEntry | undefined { return this.entries.find(entry => entry.id === id); }
  children (id: string, deleted = false): AssetEntry[] { return this.entries.filter(entry => entry.parentId === id && !!entry.deletedAt === deleted); }

  path (id: string): AssetEntry[] {
    const path: AssetEntry[] = [], visited = new Set<string>();
    let entry = this.entry(id);

    while (entry && !visited.has(entry.id)) { visited.add(entry.id); path.unshift(entry); entry = this.entry(entry.parentId); }

    return path;
  }

  pathText (id: string): string { return '/Game' + this.path(id).map(entry => '/' + entry.name).join(''); }

  descendants (id: string): AssetEntry[] {
    const ids = new Set([id]);
    let count = -1;

    while (count !== ids.size) {
      count = ids.size;
      this.entries.forEach(entry => { if (ids.has(entry.parentId)) { ids.add(entry.id); } });
    }

    return this.entries.filter(entry => ids.has(entry.id));
  }

  uniqueName (name: string, parentId: string, entries = this.entries): string {
    const names = new Set(entries.filter(entry => entry.parentId === parentId && !entry.deletedAt).map(entry => entry.name.toLowerCase()));
    let candidate = name, index = 1;

    while (names.has(candidate.toLowerCase())) { candidate = name + '_' + index++; }

    return candidate;
  }

  private checkName (name: string, parentId: string, except?: string): string {
    const next = contentAssetName(name);

    assertUniqueAssetName(this.entries.filter(entry => entry.parentId === parentId), next, except);

    return next;
  }

  private async update (entries: AssetEntry[], payloads: AssetPayload[] = []): Promise<void> { await this.storage.write(entries, payloads, undefined, this.projectId); }

  private async operation<T> (action: () => Promise<T>): Promise<T | undefined> {
    let result: T | undefined;
    const projectId = this.projectId;
    const task = this.requests.then(async () => {
      this.busy = true;
      try {
        await this.initialize();
        if (projectId && projectId !== this.projectId) { throw new Error('The active project changed before this operation finished.'); }
        if (!this.ready) { throw new Error('The content database could not be opened.'); }
        result = await action();
      } catch (error) { this.report(error); } finally { this.busy = false; this.progress = ''; }
    });

    this.requests = task;
    await task;

    return result;
  }

  async newFolder (parentId: string): Promise<string | undefined> {
    return this.operation(async () => {
      const now = Date.now(), id = generateGUID();

      await this.update([{ id, projectId: this.projectId, parentId, name: this.uniqueName('NewFolder', parentId), kind: 'folder', createdAt: now, updatedAt: now }]);

      return id;
    });
  }

  async newScene (parentId: string): Promise<string | undefined> {
    return this.operation(async () => {
      const now = Date.now(), id = generateGUID();
      const entry: AssetEntry = { id, projectId: this.projectId, parentId, name: this.uniqueName('NewScene', parentId), kind: 'scene', createdAt: now, updatedAt: now };

      await this.update([entry], [{ id, kind: 'scene', scene: createEmptyScene(), editor: { objects: {} } }]);

      return id;
    });
  }

  async importImages (files: File[], parentId: string, replaceId?: string): Promise<string[] | undefined> {
    return this.operation(async () => {
      const imported: string[] = [], failures: string[] = [];
      const folder = parentId === ASSET_ROOT || this.entry(parentId)?.kind === 'folder' && !this.entry(parentId)?.deletedAt ? parentId : ASSET_ROOT;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        this.progress = 'Importing ' + (index + 1) + ' of ' + files.length + ': ' + file.name;
        try {
          if (!/^image\//i.test(file.type) && !/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(file.name)) { throw new Error('Unsupported image format.'); }
          const image = await decodeImage(file);

          if (!image.naturalWidth || !image.naturalHeight) { throw new Error('The image has no pixels.'); }
          const old = files.length === 1 && replaceId ? this.entry(replaceId) : undefined;
          const id = old?.id ?? generateGUID(), now = Date.now();
          const entry: AssetEntry = {
            ...old, id, projectId: this.projectId, parentId: old?.parentId ?? folder, name: old?.name ?? this.uniqueName(file.name.replace(/\.[^.]+$/, '') || 'Texture', folder),
            kind: 'texture', width: image.naturalWidth, height: image.naturalHeight, mime: file.type || 'image/png',
            sourceName: file.name, size: file.size, createdAt: old?.createdAt ?? now, updatedAt: now,
          };

          await this.update([entry], [{ id, kind: 'texture', blob: file, thumbnail: await createImageThumbnail(image) }]);
          this.textureCache.invalidate();
          imported.push(id);
        } catch (error) { failures.push(file.name + ': ' + (error instanceof Error ? error.message : String(error))); }
      }
      this.notice = imported.length + (imported.length === 1 ? ' asset imported' : ' assets imported');
      if (failures.length) { throw new Error(failures.join('\n')); }

      return imported;
    });
  }

  async rename (id: string, name: string): Promise<void> {
    await this.operation(async () => {
      const entry = this.entry(id);

      if (entry) { await this.update([{ ...entry, name: this.checkName(name, entry.parentId, id), updatedAt: Date.now() }]); }
    });
  }

  async favorite (id: string): Promise<void> {
    await this.operation(async () => {
      const entry = this.entry(id);

      if (entry) { await this.update([{ ...entry, favorite: !entry.favorite }]); }
    });
  }

  async trash (ids: string[], restore = false): Promise<void> {
    await this.operation(async () => {
      const entries = [...new Map(ids.flatMap(id => {
        const root = this.entry(id);

        return !root || !!root.deletedAt !== restore ? [] : this.descendants(id).filter(entry => restore ? entry.deletedAt === root.deletedAt : !entry.deletedAt);
      }).map(entry => [entry.id, entry])).values()];
      const now = Date.now(), restoring = new Set(entries.map(entry => entry.id));
      const changes: AssetEntry[] = [];

      for (const entry of entries) {
        const parentId = restore && this.entry(entry.parentId)?.deletedAt && !restoring.has(entry.parentId) ? ASSET_ROOT : entry.parentId;
        const name = restore ? this.uniqueName(entry.name, parentId, [...this.entries.filter(old => old.id !== entry.id), ...changes]) : entry.name;

        changes.push({ ...entry, parentId, name, deletedAt: restore ? undefined : now, updatedAt: now });
      }
      await this.update(changes);
    });
  }

  async transfer (ids: string[], parentId: string, copy = false): Promise<void> {
    await this.operation(async () => {
      const selected = new Set(ids);
      const roots = ids.map(id => this.entry(id)).filter((entry): entry is AssetEntry => !!entry && !entry.deletedAt && !this.path(entry.parentId).some(parent => selected.has(parent.id)));

      if (parentId !== ASSET_ROOT && (this.entry(parentId)?.kind !== 'folder' || this.entry(parentId)?.deletedAt)) { throw new Error('Choose a valid destination folder.'); }
      const changes: AssetEntry[] = [], payloads: AssetPayload[] = [];

      for (const root of roots) {
        if (root.id === parentId || this.path(parentId).some(parent => parent.id === root.id)) { throw new Error('A folder cannot be moved into itself.'); }
        if (!copy && root.parentId === parentId) { continue; }
        const entries = copy ? this.descendants(root.id).filter(entry => !entry.deletedAt) : [root];
        const mapping = new Map(entries.map(entry => [entry.id, copy ? generateGUID() : entry.id]));

        for (const entry of entries) {
          const parent = entry.id === root.id ? parentId : mapping.get(entry.parentId)!;
          const next = { ...entry, id: mapping.get(entry.id)!, parentId: parent, name: this.uniqueName(entry.name, parent, [...this.entries.filter(old => old.id !== entry.id || copy), ...changes]), updatedAt: Date.now() };

          changes.push(next);
          if (copy && entry.kind !== 'folder') {
            const payload = await this.storage.payload(entry.id);

            if (!payload) { throw new Error('The source asset is missing: ' + entry.name); }
            payloads.push({ ...structuredClone(payload), id: next.id });
          }
        }
      }
      await this.update(changes, payloads);
    });
  }

  async savePreferences (): Promise<void> {
    try { await this.storage.write([], [], structuredClone(this.preferences), this.projectId); } catch (error) { this.report(error); }
  }

  async saveAll (): Promise<void> {
    await this.operation(async () => { await this.storage.write([], [], structuredClone(this.preferences), this.projectId); this.notice = 'All assets saved'; });
  }

  texture (engine: Engine, id: string): Texture | undefined { return this.textureCache.get(engine, id); }

  loadTexture (engine: Engine, id: string): Promise<Texture> { return this.textureCache.load(engine, id); }

  report (error: unknown): void { this.error = error instanceof Error ? error.message : String(error); console.error('Content operation failed:', error); }
}

export const assetLibrary = new AssetLibrary();
