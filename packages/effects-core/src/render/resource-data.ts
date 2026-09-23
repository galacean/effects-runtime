import type { Texture } from '../texture';
import type { GPUFramebuffer } from './gpu-framebuffer';
import { ContextItem } from './context-container';

/** Built-in render outputs. Their owners release the underlying GPU resources. */
export class ResourceData extends ContextItem {
  cameraColor?: Texture;
  bloom?: GPUFramebuffer;

  override reset (): void {
    this.cameraColor = undefined;
    this.bloom = undefined;
  }
}
