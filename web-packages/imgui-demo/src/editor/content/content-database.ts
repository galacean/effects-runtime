import { AssetsCache, type EditorAssetInfo, normalizeAssetPath } from './assets-cache';
import { isJsonAssetFile } from './json-asset-file';

export enum ContentDatabaseEvent {
  ItemAdded = 'ItemAdded',
  ItemRemoved = 'ItemRemoved',
  WorkspaceModified = 'WorkspaceModified',
  WorkspaceRebuilding = 'WorkspaceRebuilding',
  WorkspaceRebuilt = 'WorkspaceRebuilt',
}

export interface ContentDatabaseItem {
  kind: 'file' | 'folder',
  path: string,
  file?: ContentDatabaseFile,
}

export interface ContentDatabaseFile {
  name: string,
  path: string,
  typeName: string,
  lastModified: number,
  handle: FileSystemFileHandle,
  asset?: EditorAssetInfo,
}

type ContentDatabaseListener = (item?: ContentDatabaseItem) => void;

/**
 * Editor workspace database
 * It owns the folder tree, filesystem handles, workspace operations, and
 * change notifications. AssetsCache remains a metadata-only registry.
 */
export class ContentDatabase {
  readonly assetsCache: AssetsCache;

  private readonly directories = new Set<string>();
  private readonly files = new Map<string, ContentDatabaseFile>();
  private readonly listeners = new Map<ContentDatabaseEvent, Set<ContentDatabaseListener>>();
  private workspaceRootHandle: FileSystemDirectoryHandle | undefined;
  private contentRootHandle: FileSystemDirectoryHandle | undefined;
  private projectRootHandle: FileSystemDirectoryHandle | undefined;

  constructor (assetsCache = new AssetsCache()) {
    this.assetsCache = assetsCache;
  }

  get hasWorkspace (): boolean {
    return this.contentRootHandle !== undefined;
  }

  get workspaceName (): string {
    return this.workspaceRootHandle?.name ?? '';
  }

  on (event: ContentDatabaseEvent, listener: ContentDatabaseListener): () => void {
    let eventListeners = this.listeners.get(event);

    if (!eventListeners) {
      eventListeners = new Set();
      this.listeners.set(event, eventListeners);
    }
    eventListeners.add(listener);

    return () => eventListeners?.delete(listener);
  }

  getAllDirectories (): string[] {
    return Array.from(this.directories);
  }

  getAllFiles (): ContentDatabaseFile[] {
    return Array.from(this.files.values());
  }

  getFile (path: string): ContentDatabaseFile | undefined {
    return this.files.get(normalizeContentPath(path));
  }

  async initialize (rootDirectoryHandle: FileSystemDirectoryHandle): Promise<void> {
    this.workspaceRootHandle = rootDirectoryHandle;
    this.projectRootHandle = undefined;
    this.contentRootHandle = undefined;

    if (rootDirectoryHandle.name === 'Content') {
      this.contentRootHandle = rootDirectoryHandle;
    } else {
      try {
        this.contentRootHandle = await rootDirectoryHandle.getDirectoryHandle('Content');
        this.projectRootHandle = rootDirectoryHandle;
      } catch {
        // A directly selected local folder is also a valid Content root.
        this.contentRootHandle = rootDirectoryHandle;
      }
    }

    if (this.projectRootHandle) {
      const cacheDirectory = await this.projectRootHandle.getDirectoryHandle('Cache', { create: true });

      this.assetsCache.setCacheFileHandle(await cacheDirectory.getFileHandle('AssetsCache.json', { create: true }));
    } else {
      this.assetsCache.setCacheFileHandle(undefined);
    }

    await this.rebuild();
  }

  async refresh (): Promise<void> {
    if (this.contentRootHandle) {
      await this.rebuild();
    }
  }

  async getDirectoryHandle (path: string, create = false): Promise<FileSystemDirectoryHandle | undefined> {
    if (!this.contentRootHandle) {
      return undefined;
    }

    const parts = getContentRelativeParts(path);
    let directory = this.contentRootHandle;

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create });
    }

    return directory;
  }

  async getFileHandle (path: string, create = false): Promise<FileSystemFileHandle | undefined> {
    const parts = getContentRelativeParts(path);
    const fileName = parts.pop();

    if (!fileName || !this.contentRootHandle) {
      return undefined;
    }

    let directory = this.contentRootHandle;

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create });
    }

    return directory.getFileHandle(fileName, { create });
  }

  async createDirectory (path: string): Promise<void> {
    const normalizedPath = normalizeContentPath(path);
    const directory = await this.getDirectoryHandle(normalizedPath, true);

    if (!directory) {
      throw new Error(`Cannot create content directory '${normalizedPath}'.`);
    }

    this.directories.add(normalizedPath);
    const item: ContentDatabaseItem = { kind: 'folder', path: normalizedPath };

    this.emit(ContentDatabaseEvent.ItemAdded, item);
    this.emit(ContentDatabaseEvent.WorkspaceModified);
  }

  async renameFile (path: string, newFileName: string): Promise<ContentDatabaseFile> {
    const oldPath = normalizeContentPath(path);
    const info = this.files.get(oldPath);

    if (!info) {
      throw new Error(`Cannot rename unknown content item '${path}'.`);
    }
    if (!newFileName || newFileName.includes('/') || newFileName.includes('\\')) {
      throw new Error('Content item name cannot be empty or contain path separators.');
    }

    const parts = oldPath.split('/');
    const oldFileName = parts.pop()!;
    const directoryPath = parts.join('/');
    const extensionIndex = oldFileName.lastIndexOf('.');
    const extension = extensionIndex === -1 ? '' : oldFileName.slice(extensionIndex);
    const targetFileName = extension && !newFileName.toLowerCase().endsWith(extension.toLowerCase())
      ? `${newFileName}${extension}`
      : newFileName;

    if (targetFileName === oldFileName) {
      return info;
    }

    const directory = await this.getDirectoryHandle(directoryPath);

    if (!directory) {
      throw new Error(`Cannot open content directory '${directoryPath}'.`);
    }

    await assertEntryDoesNotExist(directory, targetFileName);

    const source = await directory.getFileHandle(oldFileName);
    const file = await source.getFile();
    const target = await directory.getFileHandle(targetFileName, { create: true });
    const writable = await target.createWritable();

    await writable.write(file);
    await writable.close();
    await directory.removeEntry(oldFileName);

    const newPath = `${directoryPath}/${targetFileName}`;

    const targetFile = await target.getFile();
    let renamedAsset = info.asset;

    if (renamedAsset) {
      this.assetsCache.renameAsset(oldPath, newPath);
      renamedAsset = this.assetsCache.getAssetInfo(renamedAsset.id)!;
      renamedAsset.lastModified = targetFile.lastModified;
    }

    const renamed: ContentDatabaseFile = {
      ...info,
      name: targetFileName,
      path: newPath,
      lastModified: targetFile.lastModified,
      handle: target,
      asset: renamedAsset,
    };

    this.files.delete(oldPath);
    this.files.set(newPath, renamed);
    await this.assetsCache.save();
    this.emit(ContentDatabaseEvent.ItemRemoved, { kind: 'file', path: oldPath, file: info });
    this.emit(ContentDatabaseEvent.ItemAdded, { kind: 'file', path: newPath, file: renamed });
    this.emit(ContentDatabaseEvent.WorkspaceModified);

    return renamed;
  }

  async deleteFile (path: string): Promise<void> {
    const normalizedPath = normalizeContentPath(path);
    const info = this.files.get(normalizedPath);

    if (!info) {
      return;
    }

    const parts = normalizeAssetPath(info.path).split('/');
    const fileName = parts.pop()!;
    const directory = await this.getDirectoryHandle(parts.join('/'));

    if (!directory) {
      throw new Error(`Cannot open the directory for '${info.path}'.`);
    }

    await directory.removeEntry(fileName);
    this.files.delete(normalizedPath);
    if (info.asset) {
      this.assetsCache.deleteAsset(info.asset.id);
    }
    await this.assetsCache.save();
    this.emit(ContentDatabaseEvent.ItemRemoved, { kind: 'file', path: info.path, file: info });
    this.emit(ContentDatabaseEvent.WorkspaceModified);
  }

  async renameAsset (idOrPath: string, newFileName: string): Promise<EditorAssetInfo> {
    const asset = this.assetsCache.getAssetInfo(idOrPath);

    if (!asset) {
      throw new Error(`Cannot rename unknown asset '${idOrPath}'.`);
    }

    const renamed = await this.renameFile(asset.path, newFileName);

    return renamed.asset!;
  }

  async deleteAsset (idOrPath: string): Promise<void> {
    const asset = this.assetsCache.getAssetInfo(idOrPath);

    if (asset) {
      await this.deleteFile(asset.path);
    }
  }

  registerAsset (info: EditorAssetInfo, handle?: FileSystemFileHandle): void {
    const existed = this.assetsCache.hasAsset(info.id);

    this.assetsCache.registerAsset(info);
    const path = normalizeContentPath(info.path);
    let file = this.files.get(path);

    if (!file && handle) {
      file = {
        name: handle.name,
        path,
        typeName: info.typeName,
        lastModified: info.lastModified,
        handle,
      };
      this.files.set(path, file);
    }

    if (file) {
      file.asset = this.assetsCache.getAssetInfo(info.id);
      file.typeName = info.typeName;
    }
    if (!existed && file) {
      this.emit(ContentDatabaseEvent.ItemAdded, { kind: 'file', path, file });
    }
    this.emit(ContentDatabaseEvent.WorkspaceModified, file ? { kind: 'file', path, file } : undefined);
  }

  private async rebuild (): Promise<void> {
    if (!this.contentRootHandle) {
      return;
    }

    this.emit(ContentDatabaseEvent.WorkspaceRebuilding);
    this.assetsCache.clear();
    this.directories.clear();
    this.files.clear();
    await this.scanDirectory(this.contentRootHandle, 'Content');
    await this.assetsCache.save();
    this.emit(ContentDatabaseEvent.WorkspaceModified);
    this.emit(ContentDatabaseEvent.WorkspaceRebuilt);
  }

  private async scanDirectory (directory: FileSystemDirectoryHandle, path: string): Promise<void> {
    this.directories.add(normalizeContentPath(path));

    for await (const entry of directory.values()) {
      const entryPath = `${path}/${entry.name}`;

      if (entry.kind === 'directory') {
        await this.scanDirectory(entry, entryPath);
      } else {
        await this.scanFile(entry, entryPath);
      }
    }
  }

  private async scanFile (handle: FileSystemFileHandle, path: string): Promise<void> {
    try {
      const file = await handle.getFile();
      const info: ContentDatabaseFile = {
        name: handle.name,
        path: normalizeContentPath(path),
        typeName: getFileTypeName(handle.name),
        lastModified: file.lastModified,
        handle,
      };

      this.files.set(info.path, info);

      if (!handle.name.endsWith('.json')) {
        return;
      }

      const json = JSON.parse(await file.text()) as unknown;

      if (!isJsonAssetFile(json)) {
        if (isJSONScene(json)) {
          info.typeName = 'Scene';
        }

        return;
      }

      const asset = {
        id: json.ID,
        typeName: json.TypeName,
        path,
        lastModified: file.lastModified,
      };

      this.assetsCache.registerAsset(asset);
      info.asset = this.assetsCache.getAssetInfo(asset.id);
      info.typeName = asset.typeName;
    } catch (error) {
      console.warn(`Failed to index content file '${path}'.`, error);
    }
  }

  private emit (event: ContentDatabaseEvent, item?: ContentDatabaseItem): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(item);
    }
  }
}

function getContentRelativeParts (path: string): string[] {
  const normalized = normalizeContentPath(path);

  return normalized === 'Content'
    ? []
    : normalized.slice('Content/'.length).split('/').filter(Boolean);
}

function normalizeContentPath (path: string): string {
  const normalized = normalizeAssetPath(path).replace(/^\/+|\/+$/g, '');

  if (!normalized || normalized === 'Content') {
    return 'Content';
  }

  return normalized.startsWith('Content/') ? normalized : `Content/${normalized}`;
}

async function assertEntryDoesNotExist (directory: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await directory.getFileHandle(name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }

  throw new Error(`An item named '${name}' already exists.`);
}

function isNotFoundError (error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError');
}

function getFileTypeName (name: string): string {
  const extensionIndex = name.lastIndexOf('.');

  return extensionIndex === -1 ? 'File' : `${name.slice(extensionIndex + 1).toUpperCase()} File`;
}

function isJSONScene (value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const scene = value as Record<string, unknown>;

  return typeof scene.compositionId === 'string' &&
    Array.isArray(scene.compositions) &&
    Array.isArray(scene.items) &&
    Array.isArray(scene.components);
}
