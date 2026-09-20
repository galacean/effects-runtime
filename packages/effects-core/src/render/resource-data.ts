import type { Texture } from '../texture';
import type { Framebuffer } from './framebuffer';
import { ContextItem } from './context-container';

/** Built-in render outputs. Their owners release the underlying GPU resources. */
export class ResourceData extends ContextItem {
  cameraColor?: Texture;
  bloom?: Framebuffer;

  override reset (): void {
    this.cameraColor = undefined;
    this.bloom = undefined;
  }
}
