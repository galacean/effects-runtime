import type { DataBufferOptions, spec } from '@galacean/effects-core';
import { DataBuffer, createTypedArray, getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';

type NativeBuffer = THREE.InterleavedBuffer | THREE.BufferAttribute;

/**
 * 保存渲染库可直接使用的缓冲区对象。
 */
export class ThreeDataBuffer extends DataBuffer {
  private nativeBuffer?: NativeBuffer;
  private destroyed = false;

  constructor (options: DataBufferOptions) {
    super(options);
  }

  get resource (): NativeBuffer | undefined {
    return this.nativeBuffer;
  }

  setData (data: spec.TypedArray | number): void {
    if (this.destroyed) {
      return;
    }
    const typedData = typeof data === 'number'
      ? createTypedArray(this.options.type, data / getBytesPerElement(this.options.type))
      : data;

    this.capacity = typedData.byteLength;
    if (this.options.kind === 'index') {
      if (this.nativeBuffer instanceof THREE.BufferAttribute) {
        this.nativeBuffer.array = typedData;
        this.nativeBuffer.count = typedData.length;
        this.nativeBuffer.needsUpdate = true;
      } else {
        this.nativeBuffer = new THREE.BufferAttribute(typedData, 1);
      }

      return;
    }
    const stride = this.options.byteStride > 0
      ? this.options.byteStride / typedData.BYTES_PER_ELEMENT
      : 1;

    if (this.nativeBuffer instanceof THREE.InterleavedBuffer) {
      this.nativeBuffer.array = typedData;
      this.nativeBuffer.count = typedData.length / stride;
      this.nativeBuffer.needsUpdate = true;
    } else if (this.options.instanceDivisor > 0) {
      this.nativeBuffer = new THREE.InstancedInterleavedBuffer(
        typedData,
        stride,
        this.options.instanceDivisor,
      );
    } else {
      this.nativeBuffer = new THREE.InterleavedBuffer(typedData, stride);
    }
  }

  setSubData (byteOffset: number, data: spec.TypedArray): void {
    if (!this.nativeBuffer || this.destroyed) {
      return;
    }
    if (byteOffset < 0 || byteOffset + data.byteLength > this.capacity) {
      throw new RangeError(`Buffer '${this.options.name ?? ''}' update is out of range.`);
    }
    const target = this.nativeBuffer.array as spec.TypedArray;
    const elementOffset = byteOffset / target.BYTES_PER_ELEMENT;

    target.set(data, elementOffset);
    this.nativeBuffer.updateRange.offset = elementOffset;
    this.nativeBuffer.updateRange.count = data.length;
    this.nativeBuffer.needsUpdate = true;
  }

  restore (data: spec.TypedArray | undefined, byteLength: number): void {
    this.setData(data ?? byteLength);
  }

  dispose (): void {
    this.nativeBuffer = undefined;
    this.capacity = 0;
    this.destroyed = true;
  }
}
