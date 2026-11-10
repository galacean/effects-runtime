import type { GPUBuffer } from './gpu-buffer';

/** A vertex attribute view. Buffer storage and lifetime belong to its owner. */
export interface VertexBuffer {
  readonly kind: string,
  readonly buffer: GPUBuffer,
  readonly type: number,
  readonly size: number,
  readonly byteStride: number,
  readonly byteOffset: number,
  readonly normalized: boolean,
  readonly divisor: number,
}
