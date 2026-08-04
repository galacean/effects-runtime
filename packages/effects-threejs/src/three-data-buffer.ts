import { DataBuffer } from '@galacean/effects-core';
import type * as THREE from 'three';

export type ThreeBufferResource = THREE.InterleavedBuffer | THREE.BufferAttribute;

/**
 * 保存渲染后端中的缓冲区资源。
 */
export class ThreeDataBuffer extends DataBuffer {
  constructor (public resource?: ThreeBufferResource) {
    super();
  }

  override get underlyingResource (): ThreeBufferResource | undefined {
    return this.resource;
  }
}
