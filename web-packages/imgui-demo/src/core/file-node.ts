import type { EffectsObject } from '@galacean/effects';
import { isJsonAssetFile } from '../editor/content';
import { GalaceanEffects } from '../ge';

export class FileNode {
  handle: FileSystemDirectoryHandle | FileSystemFileHandle;
  children: FileNode[] = [];
  assetType: string = '';
  assetObject: EffectsObject | undefined;
  icon: WebGLTexture | undefined;
  private fileCache: File;
  private initialized = false;

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

  instantiateAssetObject () {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    void this.getFile().then(async (file: File | undefined)=>{
      if (!file) {
        return;
      }
      try {
        const jsonAsset = JSON.parse(await file.text()) as unknown;

        if (!isJsonAssetFile(jsonAsset)) {
          return;
        }
        this.assetObject = GalaceanEffects.editorContent.loadAsync(jsonAsset.ID);
      } catch (error) {
        console.error(error);
      }
    });
  }
}
