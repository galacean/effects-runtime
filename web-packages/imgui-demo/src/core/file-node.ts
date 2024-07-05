export class FileNode {
  handle: FileSystemDirectoryHandle | FileSystemFileHandle;
  children: FileNode[] = [];
  icon?: WebGLTexture;
  private fileCache: File;

  get isFile () {
    return this.handle.kind === 'file';
  }

  async getFile () {
    if (this.fileCache) {
      return this.fileCache;
    } else {
      if (this.handle.kind === 'file') {
        this.fileCache = await this.handle.getFile();

        return this.fileCache;
      }
    }
  }
}