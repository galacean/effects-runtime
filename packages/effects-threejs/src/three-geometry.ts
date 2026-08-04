import type { Geometry } from '@galacean/effects-core';
import { getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';
import type { ThreeDataBuffer } from './three-data-buffer';

interface ThreeGeometryCache {
  version: number,
  resource: THREE.BufferGeometry,
}

const geometryCache = new WeakMap<Geometry, ThreeGeometryCache>();

export function getThreeGeometry (source: Geometry): THREE.BufferGeometry {
  source.flush();
  let cache = geometryCache.get(source);

  if (!cache || cache.version !== source.version) {
    cache?.resource.dispose();
    const geometry = source.instanceCount > 0
      ? new THREE.InstancedBufferGeometry()
      : new THREE.BufferGeometry();

    geometry.name = source.name;
    source.getAttributeNames().forEach(name => {
      const vertexBuffer = source.getVertexBuffer(name);
      const dataBuffer = vertexBuffer?.buffer.getDataBuffer() as ThreeDataBuffer | undefined;
      const nativeBuffer = dataBuffer?.resource;

      if (!vertexBuffer || !(nativeBuffer instanceof THREE.InterleavedBuffer)) {
        return;
      }
      geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(
        nativeBuffer,
        vertexBuffer.size,
        vertexBuffer.byteOffset / (nativeBuffer.array as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT,
        vertexBuffer.normalized,
      ));
    });
    const indexDataBuffer = source.getIndexBuffer()?.getDataBuffer() as ThreeDataBuffer | undefined;
    const nativeIndex = indexDataBuffer?.resource;

    if (nativeIndex instanceof THREE.BufferAttribute) {
      geometry.setIndex(nativeIndex);
    }
    if (geometry instanceof THREE.InstancedBufferGeometry) {
      geometry.instanceCount = source.instanceCount;
    }
    cache = { version: source.version, resource: geometry };
    geometryCache.set(source, cache);
  }
  const drawStart = source.getIndexBuffer()
    ? source.drawStart / getBytesPerElement(source.getIndexType())
    : source.drawStart;

  cache.resource.setDrawRange(drawStart, source.drawCount);

  return cache.resource;
}

export function disposeThreeGeometry (source: Geometry): void {
  const cache = geometryCache.get(source);

  cache?.resource.dispose();
  geometryCache.delete(source);
}
