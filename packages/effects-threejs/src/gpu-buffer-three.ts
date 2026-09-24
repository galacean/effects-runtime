import type { GPUBufferDescription, IndicesArray, spec } from '@galacean/effects-core';
import { GPUBuffer, createTypedArray, getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';

export type ThreeBufferResource = THREE.InterleavedBuffer | THREE.BufferAttribute;

export class GPUBufferThree extends GPUBuffer {
  resource?: ThreeBufferResource;

  override get underlyingResource (): ThreeBufferResource | undefined {
    return this.resource;
  }

  protected override onInitialize (description: GPUBufferDescription): void {
    if (description.index) {
      const data = normalizeIndexData(description.data);

      this.resource = new THREE.BufferAttribute(data, 1);
      this.capacity = data.byteLength;
      this.is32Bits = data instanceof Uint32Array;
    } else {
      const data = toTypedArray(description.data, description.type);
      const stride = description.byteStride > 0 ? description.byteStride / data.BYTES_PER_ELEMENT : 1;

      this.resource = description.instanceDivisor > 0
        ? new THREE.InstancedInterleavedBuffer(data, stride, description.instanceDivisor)
        : new THREE.InterleavedBuffer(data, stride);
      this.capacity = data.byteLength;
    }
  }

  protected override onReleaseGPU (): void {
    this.resource = undefined;
    super.onReleaseGPU();
  }
}

export function toTypedArray (data: number[] | ArrayBuffer | ArrayBufferView | number, type: number): spec.TypedArray {
  if (typeof data === 'number') {
    return createTypedArray(type, data / getBytesPerElement(type));
  }
  if (Array.isArray(data)) {
    const result = createTypedArray(type, data.length);

    result.set(data);

    return result;
  }
  if (data instanceof ArrayBuffer) {
    const length = data.byteLength / getBytesPerElement(type);
    const result = createTypedArray(type, length);

    new Uint8Array(result.buffer).set(new Uint8Array(data));

    return result;
  }
  if (data instanceof DataView) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  return data as spec.TypedArray;
}

function normalizeIndexData (indices: IndicesArray): Uint16Array | Uint32Array {
  if (indices instanceof Uint16Array || indices instanceof Uint32Array) {
    return indices;
  }
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= 65535) {
      return new Uint32Array(indices);
    }
  }

  return new Uint16Array(indices);
}
