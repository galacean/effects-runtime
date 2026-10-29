import { generateGUID, glContext, loadImage, SerializationHelper, spec, Texture, TextureSourceType } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { CONTENT_ROOT, assetStorage } from './content-storage';
import type { ContentEntry, AssetPayload, ContentPreferences } from './content-storage';
import { blobDataURL } from '../asset-database/asset-data';
import { createEmptyScene } from '../scene-document/scene-template';

async function imageFromBlob (blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
}

async function thumbnail (image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');

  if (!context) { throw new Error('Unable to create an image preview.'); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to create an image preview.')), 'image/png'));
}

const DEFAULTS: ContentPreferences = {
  folder: CONTENT_ROOT, view: 'tiles', thumbnailSize: 96, sourcesWidth: 216, sources: true,
  showFolders: true, recursive: true, sort: 'name', descending: false, collections: [],
};

export class ContentLibrary {
  readonly storage = assetStorage;
  entries: ContentEntry[] = [];
  preferences: ContentPreferences = { ...DEFAULTS, collections: [] };
  ready = false;
  busy = false;
  progress = '';
  error = '';
  revision = 0;
  private status = '';
  private statusTime = 0;
  private initialization?: Promise<void>;
  private requests = Promise.resolve();
  private textures = new WeakMap<Engine, Map<string, Texture>>();
  private textureRequests = new WeakMap<Engine, Map<string, Promise<Texture>>>();
  private liveTextures = new Map<string, Set<WeakRef<Texture>>>();
  private pendingEntries = new Map<string, ContentEntry>();

  constructor () {
    this.storage.subscribe(entries => {
      if (!this.ready) { entries.forEach(entry => this.pendingEntries.set(entry.id, entry)); }
      this.mergeEntries(entries);
    });
  }

  private mergeEntries (entries: ContentEntry[]): void {
    const changes = new Map(entries.map(entry => [entry.id, entry]));

    this.entries = [...this.entries.filter(entry => !changes.has(entry.id)), ...entries]; this.revision++;
    for (const entry of entries.filter(entry => entry.kind === 'texture')) {
      const references = this.liveTextures.get(entry.id);

      if (!references) { continue; }
      for (const reference of references) {
        const texture = reference.deref();

        if (!texture || texture.isDestroyed) { references.delete(reference); } else { texture.name = entry.name; texture.definition.name = entry.name; }
      }
    }
  }

  get notice (): string { return Date.now() - this.statusTime < 3500 ? this.status : ''; }
  set notice (value: string) { this.status = value; this.statusTime = Date.now(); }

  initialize (): Promise<void> {
    this.initialization ??= Promise.all([this.storage.list(), this.storage.preferences()]).then(([entries, preferences]) => {
      this.entries = entries;
      this.mergeEntries([...this.pendingEntries.values()]); this.pendingEntries.clear();
      this.preferences = { ...DEFAULTS, ...preferences, collections: preferences?.collections ?? [] };
      if (!['tiles', 'list', 'columns'].includes(this.preferences.view)) { this.preferences.view = 'tiles'; }
      this.preferences.thumbnailSize = Math.max(48, Math.min(192, this.preferences.thumbnailSize));
      this.preferences.sourcesWidth = Math.max(140, Math.min(380, this.preferences.sourcesWidth));
      if (this.preferences.folder !== CONTENT_ROOT && (this.entry(this.preferences.folder)?.kind !== 'folder' || this.entry(this.preferences.folder)?.deletedAt)) { this.preferences.folder = CONTENT_ROOT; }
      this.ready = true; this.revision++;
    }).catch(error => { this.initialization = undefined; this.report(error); });

    return this.initialization;
  }

  entry (id: string): ContentEntry | undefined { return this.entries.find(entry => entry.id === id); }
  children (id: string, deleted = false): ContentEntry[] { return this.entries.filter(entry => entry.parentId === id && !!entry.deletedAt === deleted); }

  path (id: string): ContentEntry[] {
    const path: ContentEntry[] = [], visited = new Set<string>();
    let entry = this.entry(id);

    while (entry && !visited.has(entry.id)) { visited.add(entry.id); path.unshift(entry); entry = this.entry(entry.parentId); }

    return path;
  }

  pathText (id: string): string { return '/Game' + this.path(id).map(entry => '/' + entry.name).join(''); }

  descendants (id: string): ContentEntry[] {
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
    const next = name.trim();

    if (!next || next === '.' || next === '..' || /[/\\:*?"<>|]/.test(next) || Array.from(next).some(character => character.charCodeAt(0) < 32)) { throw new Error('Use a name without slashes or special file characters.'); }
    if (this.entries.some(entry => entry.id !== except && entry.parentId === parentId && !entry.deletedAt && entry.name.toLowerCase() === next.toLowerCase())) {
      throw new Error('An item named "' + next + '" already exists in this folder.');
    }

    return next;
  }

  private async update (entries: ContentEntry[], payloads: AssetPayload[] = []): Promise<void> { await this.storage.write(entries, payloads); }

  private async operation<T> (action: () => Promise<T>): Promise<T | undefined> {
    let result: T | undefined;
    const task = this.requests.then(async () => {
      this.busy = true;
      try {
        await this.initialize();
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

      await this.update([{ id, parentId, name: this.uniqueName('NewFolder', parentId), kind: 'folder', createdAt: now, updatedAt: now }]);

      return id;
    });
  }

  async newScene (parentId: string): Promise<string | undefined> {
    return this.operation(async () => {
      const now = Date.now(), id = generateGUID();
      const entry: ContentEntry = { id, parentId, name: this.uniqueName('NewScene', parentId), kind: 'scene', createdAt: now, updatedAt: now };

      await this.update([entry], [{ id, kind: 'scene', scene: createEmptyScene(), editor: { objects: {} } }]);

      return id;
    });
  }

  async importImages (files: File[], parentId: string, replaceId?: string): Promise<string[] | undefined> {
    return this.operation(async () => {
      const imported: string[] = [], failures: string[] = [];
      const folder = parentId === CONTENT_ROOT || this.entry(parentId)?.kind === 'folder' && !this.entry(parentId)?.deletedAt ? parentId : CONTENT_ROOT;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        this.progress = 'Importing ' + (index + 1) + ' of ' + files.length + ': ' + file.name;
        try {
          if (!/^image\//i.test(file.type) && !/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(file.name)) { throw new Error('Unsupported image format.'); }
          const image = await imageFromBlob(file);

          if (!image.naturalWidth || !image.naturalHeight) { throw new Error('The image has no pixels.'); }
          const old = files.length === 1 && replaceId ? this.entry(replaceId) : undefined;
          const id = old?.id ?? generateGUID(), now = Date.now();
          const entry: ContentEntry = {
            ...old, id, parentId: old?.parentId ?? folder, name: old?.name ?? this.uniqueName(file.name.replace(/\.[^.]+$/, '') || 'Texture', folder),
            kind: 'texture', width: image.naturalWidth, height: image.naturalHeight, mime: file.type || 'image/png',
            sourceName: file.name, size: file.size, createdAt: old?.createdAt ?? now, updatedAt: now,
          };

          await this.update([entry], [{ id, kind: 'texture', blob: file, thumbnail: await thumbnail(image) }]);
          this.textures = new WeakMap(); this.textureRequests = new WeakMap();
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
      const changes: ContentEntry[] = [];

      for (const entry of entries) {
        const parentId = restore && this.entry(entry.parentId)?.deletedAt && !restoring.has(entry.parentId) ? CONTENT_ROOT : entry.parentId;
        const name = restore ? this.uniqueName(entry.name, parentId, [...this.entries.filter(old => old.id !== entry.id), ...changes]) : entry.name;

        changes.push({ ...entry, parentId, name, deletedAt: restore ? undefined : now, updatedAt: now });
      }
      await this.update(changes);
    });
  }

  async transfer (ids: string[], parentId: string, copy = false): Promise<void> {
    await this.operation(async () => {
      const selected = new Set(ids);
      const roots = ids.map(id => this.entry(id)).filter((entry): entry is ContentEntry => !!entry && !entry.deletedAt && !this.path(entry.parentId).some(parent => selected.has(parent.id)));

      if (parentId !== CONTENT_ROOT && (this.entry(parentId)?.kind !== 'folder' || this.entry(parentId)?.deletedAt)) { throw new Error('Choose a valid destination folder.'); }
      const changes: ContentEntry[] = [], payloads: AssetPayload[] = [];

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
    try { await this.storage.write([], [], structuredClone(this.preferences)); } catch (error) { this.report(error); }
  }

  async saveAll (): Promise<void> {
    await this.operation(async () => { await this.storage.write([], [], structuredClone(this.preferences)); this.notice = 'All assets saved'; });
  }

  texture (engine: Engine, id: string): Texture | undefined {
    const texture = this.textures.get(engine)?.get(id), entry = this.entry(id);

    if (texture && entry) { texture.name = entry.name; texture.definition.name = entry.name; }

    return texture;
  }

  async loadTexture (engine: Engine, id: string): Promise<Texture> {
    const cached = this.texture(engine, id);

    if (cached?.isRegistered && !cached.isDestroyed) { return cached; }
    let requests = this.textureRequests.get(engine);

    if (!requests) { requests = new Map(); this.textureRequests.set(engine, requests); }
    const pending = requests.get(id);

    if (pending) { return pending; }
    const task = (async () => {
      const entry = this.entry(id), source = await this.storage.image(id);

      if (!entry || !source) { throw new Error('The source image is missing from the content library.'); }
      const dataURL = await blobDataURL(source.blob);
      const image = await loadImage(dataURL);

      if (this.entry(id)?.updatedAt !== entry.updatedAt) {
        requests.delete(id);

        return this.loadTexture(engine, id);
      }
      const existing = engine.effectsObjectServer.objectInstance[id];
      const texture = existing instanceof Texture && !existing.isDestroyed ? existing : Texture.create(engine);
      const data = { id, name: entry.name, dataType: spec.DataType.Texture as const, source: dataURL, sourceType: TextureSourceType.image as const,
        image, flipY: true, minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE };

      SerializationHelper.deserialize(data, texture);
      if (texture === existing) { texture.updateSource(data); }
      texture.initialize();
      engine.assetServer.addEffectsObjectData(data);
      let textures = this.textures.get(engine);

      if (!textures) { textures = new Map(); this.textures.set(engine, textures); }
      textures.set(id, texture);
      let references = this.liveTextures.get(id);

      if (!references) { references = new Set(); this.liveTextures.set(id, references); }
      for (const reference of references) { if (!reference.deref() || reference.deref()!.isDestroyed) { references.delete(reference); } }
      if (![...references].some(reference => reference.deref() === texture)) { references.add(new WeakRef(texture)); }

      return texture;
    })().finally(() => requests.delete(id));

    requests.set(id, task);

    return task;
  }

  report (error: unknown): void { this.error = error instanceof Error ? error.message : String(error); console.error('Content operation failed:', error); }
}

export const contentLibrary = new ContentLibrary();
