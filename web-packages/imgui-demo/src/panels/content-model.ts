import type { ContentDatabaseFile, EditorAssetInfo } from '../editor/content';

export const CONTENT_ROOT_PATH = 'Content';

export type ContentSortOrder = 'ascending' | 'descending';

export interface ContentFolderEntry {
  kind: 'folder',
  name: string,
  path: string,
  parentPath: string | undefined,
  childPaths: string[],
  assetIds: string[],
  filePaths: string[],
}

export interface ContentAssetEntry {
  kind: 'asset',
  name: string,
  path: string,
  parentPath: string,
  info: EditorAssetInfo,
}

export interface ContentFileEntry {
  kind: 'file',
  name: string,
  path: string,
  parentPath: string,
  info: ContentDatabaseFile,
}

export type ContentBrowserEntry = ContentFolderEntry | ContentAssetEntry | ContentFileEntry;
export type ContentFileSystemEntry = ContentAssetEntry | ContentFileEntry;

/**
 * State and path operations for the Content window. It intentionally only
 * knows editor metadata, so browsing never causes runtime assets to load.
 */
export class ContentBrowserModel {
  private readonly folders = new Map<string, ContentFolderEntry>();
  private readonly assets = new Map<string, ContentAssetEntry>();
  private readonly files = new Map<string, ContentFileEntry>();
  private backwardHistory: string[] = [];
  private forwardHistory: string[] = [];

  currentPath = CONTENT_ROOT_PATH;
  sortOrder: ContentSortOrder = 'ascending';

  get canNavigateBackward (): boolean {
    return this.backwardHistory.length > 0;
  }

  get canNavigateForward (): boolean {
    return this.forwardHistory.length > 0;
  }

  get canNavigateUp (): boolean {
    return this.currentPath !== CONTENT_ROOT_PATH;
  }

  setSnapshot (
    directories: readonly string[],
    assets: readonly EditorAssetInfo[],
    files: readonly ContentDatabaseFile[] = [],
  ): void {
    this.folders.clear();
    this.assets.clear();
    this.files.clear();
    this.ensureFolder(CONTENT_ROOT_PATH);

    for (const path of directories) {
      const normalized = normalizeContentPath(path);

      if (isContentPath(normalized)) {
        this.ensureFolder(normalized);
      }
    }

    for (const info of assets) {
      const path = normalizeContentPath(info.path);

      if (!isContentPath(path) || path === CONTENT_ROOT_PATH) {
        continue;
      }
      const parentPath = getParentPath(path) ?? CONTENT_ROOT_PATH;
      const parent = this.ensureFolder(parentPath);
      const entry: ContentAssetEntry = {
        kind: 'asset',
        name: getPathName(path),
        path,
        parentPath,
        info,
      };

      this.assets.set(info.id, entry);
      parent.assetIds.push(info.id);
    }

    for (const info of files) {
      const path = normalizeContentPath(info.path);

      if (!isContentPath(path) || path === CONTENT_ROOT_PATH || info.asset) {
        continue;
      }

      const parentPath = getParentPath(path) ?? CONTENT_ROOT_PATH;
      const parent = this.ensureFolder(parentPath);
      const entry: ContentFileEntry = {
        kind: 'file',
        name: getPathName(path),
        path,
        parentPath,
        info,
      };

      this.files.set(path, entry);
      parent.filePaths.push(path);
    }

    if (!this.folders.has(this.currentPath)) {
      this.currentPath = CONTENT_ROOT_PATH;
    }
    this.backwardHistory = this.backwardHistory.filter(path => this.folders.has(path));
    this.forwardHistory = this.forwardHistory.filter(path => this.folders.has(path));
    this.sortChildren();
  }

  getFolder (path: string): ContentFolderEntry | undefined {
    return this.folders.get(normalizeContentPath(path));
  }

  getAsset (id: string): ContentAssetEntry | undefined {
    return this.assets.get(id);
  }

  getFile (path: string): ContentFileEntry | undefined {
    return this.files.get(normalizeContentPath(path));
  }

  getBreadcrumbs (): ContentFolderEntry[] {
    const result: ContentFolderEntry[] = [];
    let path: string | undefined = this.currentPath;

    while (path) {
      const folder = this.folders.get(path);

      if (!folder) {
        break;
      }
      result.unshift(folder);
      path = folder.parentPath;
    }

    return result;
  }

  getVisibleFolders (query: string): ContentFolderEntry[] {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = new Set<string>();

    if (!normalizedQuery) {
      return Array.from(this.folders.values());
    }

    for (const folder of this.folders.values()) {
      if (folder.name.toLowerCase().includes(normalizedQuery) || folder.path.toLowerCase().includes(normalizedQuery)) {
        let path: string | undefined = folder.path;

        while (path) {
          visible.add(path);
          path = this.folders.get(path)?.parentPath;
        }
      }
    }

    return Array.from(visible, path => this.folders.get(path)!).filter(Boolean);
  }

  getItems (query: string, typeFilters: ReadonlySet<string>): ContentBrowserEntry[] {
    const folder = this.folders.get(this.currentPath);

    if (!folder) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const isSearching = normalizedQuery.length > 0 || typeFilters.size > 0;
    const result: ContentBrowserEntry[] = [];

    if (isSearching) {
      this.collectMatchingItems(folder, normalizedQuery, typeFilters, result);
    } else {
      for (const childPath of folder.childPaths) {
        const child = this.folders.get(childPath);

        if (child) {
          result.push(child);
        }
      }
      for (const id of folder.assetIds) {
        const asset = this.assets.get(id);

        if (asset) {
          result.push(asset);
        }
      }
      for (const path of folder.filePaths) {
        const file = this.files.get(path);

        if (file) {
          result.push(file);
        }
      }
    }

    const direction = this.sortOrder === 'ascending' ? 1 : -1;

    return result.sort((a, b) => {
      if (!isSearching) {
        const kindOrder = Number(a.kind !== 'folder') - Number(b.kind !== 'folder');

        if (kindOrder !== 0) {
          return kindOrder;
        }
      }

      return direction * a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  getAssetTypes (): string[] {
    return Array.from(new Set([
      ...Array.from(this.assets.values(), asset => asset.info.typeName),
      ...Array.from(this.files.values(), file => file.info.typeName),
    ]))
      .sort((a, b) => a.localeCompare(b));
  }

  navigate (path: string): boolean {
    const normalized = normalizeContentPath(path);

    if (!this.folders.has(normalized) || normalized === this.currentPath) {
      return false;
    }
    this.backwardHistory.push(this.currentPath);
    this.forwardHistory.length = 0;
    this.currentPath = normalized;

    return true;
  }

  navigateBackward (): boolean {
    const target = this.backwardHistory.pop();

    if (!target) {
      return false;
    }
    this.forwardHistory.push(this.currentPath);
    this.currentPath = target;

    return true;
  }

  navigateForward (): boolean {
    const target = this.forwardHistory.pop();

    if (!target) {
      return false;
    }
    this.backwardHistory.push(this.currentPath);
    this.currentPath = target;

    return true;
  }

  navigateUp (): boolean {
    const parent = this.folders.get(this.currentPath)?.parentPath;

    return parent ? this.navigate(parent) : false;
  }

  private ensureFolder (path: string): ContentFolderEntry {
    const normalized = normalizeContentPath(path);
    const existing = this.folders.get(normalized);

    if (existing) {
      return existing;
    }

    const parentPath = normalized === CONTENT_ROOT_PATH ? undefined : getParentPath(normalized) ?? CONTENT_ROOT_PATH;
    const folder: ContentFolderEntry = {
      kind: 'folder',
      name: getPathName(normalized),
      path: normalized,
      parentPath,
      childPaths: [],
      assetIds: [],
      filePaths: [],
    };

    this.folders.set(normalized, folder);
    if (parentPath) {
      const parent = this.ensureFolder(parentPath);

      if (!parent.childPaths.includes(normalized)) {
        parent.childPaths.push(normalized);
      }
    }

    return folder;
  }

  private collectMatchingItems (
    folder: ContentFolderEntry,
    query: string,
    typeFilters: ReadonlySet<string>,
    result: ContentBrowserEntry[],
  ): void {
    for (const id of folder.assetIds) {
      const asset = this.assets.get(id);

      if (asset &&
        (typeFilters.size === 0 || typeFilters.has(asset.info.typeName)) &&
        (!query || asset.name.toLowerCase().includes(query) || asset.info.id.toLowerCase() === query)) {
        result.push(asset);
      }
    }
    for (const path of folder.filePaths) {
      const file = this.files.get(path);

      if (file &&
        (typeFilters.size === 0 || typeFilters.has(file.info.typeName)) &&
        (!query || file.name.toLowerCase().includes(query))) {
        result.push(file);
      }
    }
    for (const childPath of folder.childPaths) {
      const child = this.folders.get(childPath);

      if (child) {
        this.collectMatchingItems(child, query, typeFilters, result);
      }
    }
  }

  private sortChildren (): void {
    for (const folder of this.folders.values()) {
      folder.childPaths.sort((a, b) => getPathName(a).localeCompare(getPathName(b), undefined, { sensitivity: 'base', numeric: true }));
      folder.assetIds.sort((a, b) => {
        const aName = this.assets.get(a)?.name ?? a;
        const bName = this.assets.get(b)?.name ?? b;

        return aName.localeCompare(bName, undefined, { sensitivity: 'base', numeric: true });
      });
      folder.filePaths.sort((a, b) => getPathName(a).localeCompare(getPathName(b), undefined, { sensitivity: 'base', numeric: true }));
    }
  }
}

export function normalizeContentPath (path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');

  return normalized || CONTENT_ROOT_PATH;
}

function isContentPath (path: string): boolean {
  return path === CONTENT_ROOT_PATH || path.startsWith(`${CONTENT_ROOT_PATH}/`);
}

function getParentPath (path: string): string | undefined {
  const index = path.lastIndexOf('/');

  return index === -1 ? undefined : path.slice(0, index);
}

function getPathName (path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
