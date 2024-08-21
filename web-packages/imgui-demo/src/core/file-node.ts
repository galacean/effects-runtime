import type { EffectsObject } from '@galacean/effects';
import { GalaceanEffects } from '../ge';

export class FileNode {
  handle: FileSystemDirectoryHandle | FileSystemFileHandle;
  children: FileNode[] = [];
  assetType: string = '';
  assetObject: EffectsObject | undefined;
  icon: WebGLTexture | undefined;
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

  instantiateAssetObject () {
    if (this.assetObject) {
      return;
    }
    void this.getFile().then(async (file: File | undefined)=>{
      if (!file) {
        return;
      }
      try {
        const effectsPackage = await GalaceanEffects.assetDataBase.loadPackageFile(file);

        if (!effectsPackage) {
          return;
        }
        this.assetObject = effectsPackage.exportObjects[0];
      } catch (error) {
        console.error(error);
      }
    });
  }
}