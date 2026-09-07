export interface EditorAssetInfo {
  id: string,
  typeName: string,
  path: string,
  lastModified: number,
}

export interface SerializedAssetsCache {
  version: 1,
  assets: EditorAssetInfo[],
}

/**
 * Editor asset registry
 *
 * This class owns GUID/path/type metadata and its cache persistence. Directory
 * discovery, asset file access, and workspace mutations belong to ContentDatabase.
 */
export class AssetsCache {
  private readonly assets = new Map<string, EditorAssetInfo>();
  private readonly paths = new Map<string, string>();
  private cacheFileHandle: FileSystemFileHandle | undefined;
  private dirty = false;

  get size (): number {
    return this.assets.size;
  }

  get isDirty (): boolean {
    return this.dirty;
  }

  clear (): void {
    this.assets.clear();
    this.paths.clear();
    this.dirty = true;
  }

  setCacheFileHandle (handle: FileSystemFileHandle | undefined): void {
    this.cacheFileHandle = handle;
  }

  getAssetInfo (idOrPath: string): EditorAssetInfo | undefined {
    const normalizedPath = normalizeAssetPath(idOrPath);
    const id = this.paths.get(normalizedPath) ?? idOrPath;

    return this.assets.get(id);
  }

  hasAsset (idOrPath: string): boolean {
    return this.getAssetInfo(idOrPath) !== undefined;
  }

  getAllAssets (): EditorAssetInfo[] {
    return Array.from(this.assets.values());
  }

  registerAsset (info: EditorAssetInfo): void {
    const path = normalizeAssetPath(info.path);
    const oldInfo = this.assets.get(info.id);

    if (oldInfo) {
      this.paths.delete(normalizeAssetPath(oldInfo.path));
    }

    const oldId = this.paths.get(path);

    if (oldId && oldId !== info.id) {
      this.assets.delete(oldId);
    }

    this.assets.set(info.id, { ...info, path });
    this.paths.set(path, info.id);
    this.dirty = true;
  }

  deleteAsset (idOrPath: string): EditorAssetInfo | undefined {
    const info = this.getAssetInfo(idOrPath);

    if (!info) {
      return undefined;
    }

    this.assets.delete(info.id);
    this.paths.delete(normalizeAssetPath(info.path));
    this.dirty = true;

    return info;
  }

  renameAsset (oldPath: string, newPath: string): boolean {
    const info = this.getAssetInfo(oldPath);

    if (!info) {
      return false;
    }

    const normalizedOldPath = normalizeAssetPath(info.path);
    const normalizedNewPath = normalizeAssetPath(newPath);

    this.paths.delete(normalizedOldPath);
    info.path = normalizedNewPath;
    this.paths.set(normalizedNewPath, info.id);
    this.dirty = true;

    return true;
  }

  async save (): Promise<void> {
    if (!this.cacheFileHandle || !this.dirty) {
      return;
    }

    const writable = await this.cacheFileHandle.createWritable();
    const data: SerializedAssetsCache = {
      version: 1,
      assets: this.getAllAssets(),
    };

    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    this.dirty = false;
  }
}

export function normalizeAssetPath (path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}
