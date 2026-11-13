import type { GPUBuffer, Engine, Geometry, VertexBuffer } from '@galacean/effects-core';
import * as THREE from 'three';
import type { GPUBufferThree } from './gpu-buffer-three';

interface ThreeGeometryCache {
  vertexBuffers: Readonly<Record<string, VertexBuffer>>,
  indexBuffer?: GPUBuffer,
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
  const vertexBuffers = source.getVertexBuffers();
  const indexBuffer = source.getIndexBuffer();
  const instanced = source.instanceCount > 0;

  if (!cache || !isCacheValid(cache, vertexBuffers, indexBuffer, instanced)) {
    if (cache) {
      cache.resource.dispose();
    }
    const geometry = instanced
      ? new THREE.InstancedBufferGeometry()
      : new THREE.BufferGeometry();

    geometry.name = source.name;
    Object.keys(vertexBuffers).forEach(name => {
      const view = vertexBuffers[name];
      const nativeBuffer = (view.buffer as GPUBufferThree).getVertexResource(view);

      if (!nativeBuffer) {
        return;
      }
      const bytesPerElement = (nativeBuffer.array as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT;

      // Three.js expresses stride and offset in backing-array elements.
      geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(
        nativeBuffer,
        view.size,
        view.byteOffset / bytesPerElement,
        view.normalized,
      ));
    });
    const indexGPUBuffer = indexBuffer as GPUBufferThree | undefined;
    const nativeIndex = indexGPUBuffer?.resource;

    if (nativeIndex instanceof THREE.BufferAttribute) {
      geometry.setIndex(nativeIndex);
    }
    cache = { vertexBuffers, indexBuffer, instanced, resource: geometry };
    geometryCache.set(source, cache);
  }
  if (cache.resource instanceof THREE.InstancedBufferGeometry) {
    cache.resource.instanceCount = source.instanceCount;
  }
  const drawStart = indexBuffer
    ? source.getDrawStart() / (indexBuffer.is32Bits ? Uint32Array.BYTES_PER_ELEMENT : Uint16Array.BYTES_PER_ELEMENT)
    : source.getDrawStart();

  cache.resource.setDrawRange(drawStart, source.getDrawCount());

  return cache.resource;
}

function isCacheValid (
  cache: ThreeGeometryCache,
  vertexBuffers: Readonly<Record<string, VertexBuffer>>,
  indexBuffer: GPUBuffer | undefined,
  instanced: boolean,
): boolean {
  if (cache.indexBuffer !== indexBuffer
    || cache.resource.index !== ((indexBuffer as GPUBufferThree | undefined)?.resource ?? null)
    || cache.instanced !== instanced
    || cache.vertexBuffers !== vertexBuffers) {
    return false;
  }

  return Object.keys(vertexBuffers).every(name => {
    const view = vertexBuffers[name];
    const nativeBuffer = (view.buffer as GPUBufferThree).getVertexResource(view);
    const attribute = cache.resource.getAttribute(name);

    if (!nativeBuffer) {
      return attribute === undefined;
    }

    return attribute instanceof THREE.InterleavedBufferAttribute
      && attribute.data === nativeBuffer;
  });
}

/** Releases only the native geometries created for this display object's engine. */
export function disposeThreeGeometries (engine: Engine): void {
  const geometryCache = geometryCaches.get(engine);

  geometryCache?.forEach(cache => cache.resource.dispose());
  geometryCaches.delete(engine);
}
