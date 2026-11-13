import type { GPUBufferDescription, IndicesArray, VertexBuffer, spec } from '@galacean/effects-core';
import { GPUBuffer, BufferDataType, createTypedArray, getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';

export type ThreeBufferResource = THREE.InterleavedBuffer | THREE.BufferAttribute;

const arrayTypes: Record<number, new (buffer: ArrayBufferLike, byteOffset: number, length: number) => spec.TypedArray> = {
  [BufferDataType.Byte]: Int8Array,
  [BufferDataType.UnsignedByte]: Uint8Array,
  [BufferDataType.Short]: Int16Array,
  [BufferDataType.UnsignedShort]: Uint16Array,
  [BufferDataType.Int]: Int32Array,
  [BufferDataType.UnsignedInt]: Uint32Array,
  [BufferDataType.Float]: Float32Array,
};

export class GPUBufferThree extends GPUBuffer {
  resource?: ThreeBufferResource;
  private readonly vertexResources = new Map<string, THREE.InterleavedBuffer>();

  override get underlyingResource (): ThreeBufferResource | undefined {
    return this.resource;
  }

  /** Reuses native streams with compatible formats without mutating shared strides. */
  getVertexResource (view: VertexBuffer): THREE.InterleavedBuffer | undefined {
    const resource = this.resource;

    if (!(resource instanceof THREE.InterleavedBuffer)) {
      return;
    }
    const { type, divisor } = view;
    const bytesPerElement = getBytesPerElement(type);
    const stride = view.byteStride ? view.byteStride / bytesPerElement : view.size;
    const array = resource.array as spec.TypedArray;
    const ArrayType = arrayTypes[type];
    const resourceDivisor = resource instanceof THREE.InstancedInterleavedBuffer ? resource.meshPerAttribute : 0;

    if (array.constructor === ArrayType && resource.stride === stride && resourceDivisor === divisor) {
      return resource;
    }
    const key = `${type}/${stride}/${divisor}`;
    let native = this.vertexResources.get(key);

    if (!native) {
      const data = new ArrayType(array.buffer, array.byteOffset, array.byteLength / bytesPerElement);

      native = divisor > 0
        ? new THREE.InstancedInterleavedBuffer(data, stride, divisor)
        : new THREE.InterleavedBuffer(data, stride);
      native.setUsage(resource.usage);
      this.vertexResources.set(key, native);
    }

    return native;
  }

  /** All native views share CPU bytes, but Three tracks their GPU uploads separately. */
  markVertexBuffersUpdated (byteOffset: number, byteLength: number): void {
    const resources: ThreeBufferResource[] = Array.from(this.vertexResources.values());

    if (this.resource) {
      resources.push(this.resource);
    }
    for (const resource of resources) {
      const bytesPerElement = (resource.array as spec.TypedArray).BYTES_PER_ELEMENT;
      const range = resource.updateRange;
      let start = Math.floor(byteOffset / bytesPerElement);
      let end = Math.ceil((byteOffset + byteLength) / bytesPerElement);

      if (range.count > 0) {
        start = Math.min(start, range.offset);
        end = Math.max(end, range.offset + range.count);
      }
      range.offset = start;
      range.count = end - start;
      resource.needsUpdate = true;
    }
  }

  protected override onInitialize (description: GPUBufferDescription): void {
    if (description.index) {
      const data = normalizeIndexData(description.data);
      const attribute = new THREE.BufferAttribute(data, 1);

      attribute.onUpload(() => { attribute.updateRange.count = -1; });
      this.resource = attribute;
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
    this.vertexResources.clear();
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
