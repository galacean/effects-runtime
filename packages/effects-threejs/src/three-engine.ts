import type {
  Composition, DataBuffer, DataBufferOptions, EngineOptions, Geometry, IndicesArray, spec,
} from '@galacean/effects-core';
import {
  BufferDataType, Engine, GPUCapability, createTypedArray, getBytesPerElement,
} from '@galacean/effects-core';
import * as THREE from 'three';
import { ThreeRenderer } from './three-renderer';
import { ThreeDataBuffer } from './three-data-buffer';
import { disposeThreeGeometry } from './three-geometry';

export interface ThreeEngineOptions {
  threeCamera?: THREE.Camera,
  composition: Composition,
  threeGroup: THREE.Group,
}

type BufferData = number[] | ArrayBuffer | ArrayBufferView;

/**
 * 挂载着合成需要的全局对象等
 */
export class ThreeEngine extends Engine {
  threeCamera?: THREE.Camera;
  threeGroup: THREE.Group;
  composition: Composition;

  constructor (gl: WebGLRenderingContext | WebGL2RenderingContext, options?: EngineOptions) {
    super(gl.canvas as HTMLCanvasElement, options);

    this.renderer = new ThreeRenderer(this);
    this.gpuCapability = new GPUCapability(gl);
  }

  setOptions (threeEngineOptions: ThreeEngineOptions) {
    const { threeCamera, threeGroup, composition } = threeEngineOptions;

    this.threeCamera = threeCamera;
    this.threeGroup = threeGroup;
    this.composition = composition;
  }

  override createVertexBuffer (
    data: BufferData | number,
    options: DataBufferOptions,
  ): ThreeDataBuffer {
    const typedData = toTypedArray(data, options.type);
    const stride = options.byteStride > 0
      ? options.byteStride / typedData.BYTES_PER_ELEMENT
      : 1;
    const resource = options.instanceDivisor > 0
      ? new THREE.InstancedInterleavedBuffer(typedData, stride, options.instanceDivisor)
      : new THREE.InterleavedBuffer(typedData, stride);

    return createDataBuffer(resource, typedData.byteLength);
  }

  override createDynamicVertexBuffer (
    data: BufferData | number,
    options: DataBufferOptions,
  ): ThreeDataBuffer {
    return this.createVertexBuffer(data, options);
  }

  override createIndexBuffer (
    indices: IndicesArray,
  ): ThreeDataBuffer {
    const data = normalizeIndexData(indices);
    const buffer = createDataBuffer(new THREE.BufferAttribute(data, 1), data.byteLength);

    buffer.is32Bits = data instanceof Uint32Array;

    return buffer;
  }

  override updateDynamicVertexBuffer (
    vertexBuffer: DataBuffer,
    data: BufferData,
    byteOffset = 0,
    byteLength?: number,
  ): void {
    let view = toTypedArray(data, BufferDataType.Float);

    if (byteLength !== undefined && byteLength < view.byteLength) {
      view = new Uint8Array(view.buffer, view.byteOffset, byteLength);
    }
    const resource = (vertexBuffer as ThreeDataBuffer).resource;

    if (!resource) {
      return;
    }
    if (byteOffset < 0 || byteOffset + view.byteLength > vertexBuffer.capacity) {
      throw new RangeError('Buffer update is out of range.');
    }
    const target = resource.array as spec.TypedArray;
    const elementOffset = byteOffset / target.BYTES_PER_ELEMENT;

    if (!Number.isInteger(elementOffset)) {
      throw new RangeError('Buffer update is not aligned.');
    }
    target.set(view, elementOffset);
    resource.updateRange.offset = elementOffset;
    resource.updateRange.count = view.length;
    resource.needsUpdate = true;
  }

  override updateDynamicIndexBuffer (
    indexBuffer: DataBuffer,
    indices: IndicesArray,
    byteOffset = 0,
  ): void {
    const data = indexBuffer.is32Bits
      ? indices instanceof Uint32Array ? indices : new Uint32Array(indices)
      : indices instanceof Uint16Array ? indices : new Uint16Array(indices);

    const resource = (indexBuffer as ThreeDataBuffer).resource;

    if (!resource) {
      return;
    }
    if (byteOffset < 0 || byteOffset + data.byteLength > indexBuffer.capacity) {
      throw new RangeError('Buffer update is out of range.');
    }
    const target = resource.array as spec.TypedArray;
    const elementOffset = byteOffset / target.BYTES_PER_ELEMENT;

    if (!Number.isInteger(elementOffset)) {
      throw new RangeError('Buffer update is not aligned.');
    }
    target.set(data, elementOffset);
    resource.updateRange.offset = elementOffset;
    resource.updateRange.count = data.length;
    resource.needsUpdate = true;
  }

  /** @hide */
  override releaseBuffer (buffer: DataBuffer): boolean {
    buffer.references--;
    if (buffer.references !== 0) {
      return false;
    }
    (buffer as ThreeDataBuffer).resource = undefined;
    buffer.capacity = 0;

    return true;
  }

  override removeGeometry (geometry: Geometry): void {
    disposeThreeGeometry(geometry);
    super.removeGeometry(geometry);
  }
}

function toTypedArray (data: BufferData | number, type: number): spec.TypedArray {
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

function createDataBuffer (
  resource: THREE.InterleavedBuffer | THREE.BufferAttribute,
  capacity: number,
): ThreeDataBuffer {
  const buffer = new ThreeDataBuffer(resource);

  buffer.capacity = capacity;
  buffer.references = 1;

  return buffer;
}
