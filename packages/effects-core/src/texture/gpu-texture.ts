import { GPUResource } from '../gpu-resource';
import type { TextureSourceOptions } from './types';

/** Backend allocation only. Asset identity and CPU sources belong to Texture. */
export abstract class GPUTexture extends GPUResource {
  width = 0;
  height = 0;

  get isInitialized (): boolean { return this.initialized; }

  initialize (source: TextureSourceOptions): void {
    this.releaseGPU();
    this.onInitialize(source);
    this.initialized = true;
  }

  abstract update (source: TextureSourceOptions, options?: TextureSourceOptions): void;
  abstract offloadData (): void;
  abstract restore (source: TextureSourceOptions): void;
  protected abstract onInitialize (source: TextureSourceOptions): void;

  protected override onReleaseGPU (): void {
    this.width = this.height = 0;
  }
}
