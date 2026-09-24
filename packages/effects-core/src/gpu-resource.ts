import { EventEmitter } from './events';
import type { RenderingDevice } from './rendering-device';
import type { Disposable } from './utils';

/** GPU allocation lifetime, independent of asset identity and ownership. */
export abstract class GPUResource extends EventEmitter<{ releasing: [GPUResource] }> implements Disposable {
  device: RenderingDevice | null;

  protected initialized = false;
  protected destroyed = false;

  constructor (device: RenderingDevice) {
    super();
    device.addResource(this);
    this.device = device;
  }

  get isDestroyed (): boolean { return this.destroyed; }

  /** Releases the allocation while keeping the resource registered for reuse. */
  releaseGPU (): void {
    if (!this.initialized) {
      return;
    }
    this.emit('releasing', this);
    this.onReleaseGPU();
    this.initialized = false;
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.releaseGPU();
    this.detachDevice();
  }

  /** The owner can still safely dispose this object after the device closes. */
  onDeviceDispose (): void {
    this.releaseGPU();
    this.detachDevice();
  }

  protected abstract onReleaseGPU (): void;

  private detachDevice (): void {
    this.device?.removeResource(this);
    this.device = null;
  }
}
