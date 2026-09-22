import type { DataBuffer, Engine, Geometry, VertexBuffer } from '@galacean/effects-core';
import { getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';
import type { ThreeDataBuffer } from './three-data-buffer';

interface ThreeGeometryCache {
  vertexBuffers: Record<string, VertexBuffer>,
  indexBuffer?: DataBuffer,
  instanced: boolean,
  resource: THREE.BufferGeometry,
}

const geometryCaches = new WeakMap<Engine, Map<Geometry, ThreeGeometryCache>>();

export function getThreeGeometry (source: Geometry): THREE.BufferGeometry {
  source.flush();
  let geometryCache = geometryCaches.get(source.engine);

  if (!geometryCache) {
    geometryCache = new Map();
    geometryCaches.set(source.engine, geometryCache);
  }
  let cache = geometryCache.get(source);
  const attributeNames = source.getAttributeNames();
  const indexBuffer = source.getIndexBuffer();
  const instanced = source.instanceCount > 0;

  if (!cache || !isCacheValid(source, cache, attributeNames, indexBuffer, instanced)) {
    cache?.resource.dispose();
    const geometry = instanced
      ? new THREE.InstancedBufferGeometry()
      : new THREE.BufferGeometry();
    const vertexBuffers: Record<string, VertexBuffer> = {};

    geometry.name = source.name;
    attributeNames.forEach(name => {
      const vertexBuffer = source.getVertexBuffer(name);
      const dataBuffer = vertexBuffer?.getBuffer() as ThreeDataBuffer | undefined;
      const nativeBuffer = dataBuffer?.resource;

      if (!vertexBuffer || !(nativeBuffer instanceof THREE.InterleavedBuffer)) {
        return;
      }
      vertexBuffers[name] = vertexBuffer;
      // A tightly packed buffer may only specify its stride on the vertex binding.
      nativeBuffer.stride = vertexBuffer.getStrideSize();
      nativeBuffer.count = nativeBuffer.array.length / nativeBuffer.stride;
      geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(
        nativeBuffer,
        vertexBuffer.getSize(),
        vertexBuffer.byteOffset / (nativeBuffer.array as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT,
        vertexBuffer.normalized,
      ));
    });
    const indexDataBuffer = indexBuffer as ThreeDataBuffer | undefined;
    const nativeIndex = indexDataBuffer?.resource;

    if (nativeIndex instanceof THREE.BufferAttribute) {
      geometry.setIndex(nativeIndex);
    }
    cache = { vertexBuffers, indexBuffer, instanced, resource: geometry };
    geometryCache.set(source, cache);
  }
  if (cache.resource instanceof THREE.InstancedBufferGeometry) {
    cache.resource.instanceCount = source.instanceCount;
  }
  const drawStart = source.getIndexBuffer()
    ? source.getDrawStart() / getBytesPerElement(source.getIndexType())
    : source.getDrawStart();

  cache.resource.setDrawRange(drawStart, source.getDrawCount());

  return cache.resource;
}

function isCacheValid (
  source: Geometry,
  cache: ThreeGeometryCache,
  attributeNames: string[],
  indexBuffer: DataBuffer | undefined,
  instanced: boolean,
): boolean {
  if (cache.indexBuffer !== indexBuffer
    || cache.instanced !== instanced
    || Object.keys(cache.vertexBuffers).length !== attributeNames.length) {
    return false;
  }

  return attributeNames.every(name => cache.vertexBuffers[name] === source.getVertexBuffer(name));
}

/** Releases only the native geometries created for this display object's engine. */
export function disposeThreeGeometries (engine: Engine): void {
  const geometryCache = geometryCaches.get(engine);

  geometryCache?.forEach(cache => cache.resource.dispose());
  geometryCaches.delete(engine);
}
