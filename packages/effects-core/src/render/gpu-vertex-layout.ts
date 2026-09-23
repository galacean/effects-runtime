import { GPUResource } from '../gpu-resource';
import type { RenderingDevice } from '../rendering-device';
import type { VertexElement } from './vertex-element';

/** Device-owned, shared vertex layout. Contains no buffer references. */
export class GPUVertexLayout extends GPUResource {
  readonly elements: readonly VertexElement[];
  private readonly strides: readonly number[];

  /** @internal Use RenderingDevice.getVertexLayout to reuse matching layouts. */
  constructor (device: RenderingDevice, elements: readonly VertexElement[], strides: readonly number[]) {
    super(device);
    this.elements = elements.map(element => ({ ...element }));
    this.strides = strides.slice();
  }

  getElement (name: string): VertexElement | undefined {
    return this.elements.find(element => element.name === name);
  }

  getStride (slot: number): number {
    return this.strides[slot];
  }

  protected override onReleaseGPU (): void {
    // WebGL and Three consume this CPU descriptor; there is no native allocation.
  }
}
