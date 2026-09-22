import type { RenderingDevice } from '../rendering-device';
import type { Disposable } from '../utils';
import type { TextureSourceOptions } from './types';

/** Backend allocation only. Asset identity and CPU sources belong to Texture. */
export abstract class GPUTexture implements Disposable {
  width = 0;
  height = 0;
  protected initialized = false;
  protected destroyed = false;

  constructor (protected readonly device: RenderingDevice) {}

  get isInitialized (): boolean { return this.initialized; }
  get isDestroyed (): boolean { return this.destroyed; }

  abstract initialize (source: TextureSourceOptions): void;
  abstract update (source: TextureSourceOptions, options?: TextureSourceOptions): void;
  abstract offloadData (): void;
  abstract restore (source: TextureSourceOptions): void;
  abstract dispose (): void;
}
