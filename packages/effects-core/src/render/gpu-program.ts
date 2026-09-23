import { GPUResource } from '../gpu-resource';
import type { RenderingDevice } from '../rendering-device';

/** Linked GPU program resource. Shader assets and compilation remain with their owners. */
export abstract class GPUProgram extends GPUResource {
  constructor (device: RenderingDevice, readonly key: string) {
    super(device);
  }

  abstract bind (): void;
  /** @hide */
  abstract getAttributesNames (): readonly string[];
  /** @hide */
  abstract getAttributeLocation (index: number): number;
}
