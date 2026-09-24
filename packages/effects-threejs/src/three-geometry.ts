import type { GPUBuffer, Engine, Geometry, GPUVertexLayout } from '@galacean/effects-core';
import { getBytesPerElement } from '@galacean/effects-core';
import * as THREE from 'three';
import type { GPUBufferThree } from './gpu-buffer-three';

interface ThreeGeometryCache {
  vertexLayout?: GPUVertexLayout,
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
  const vertexLayout = source.getVertexLayout();
  const indexBuffer = source.getIndexBuffer();
  const instanced = source.instanceCount > 0;

  if (!cache || !isCacheValid(source, cache, vertexLayout, indexBuffer, instanced)) {
    if (cache) {
      cache.resource.dispose();
    }
    const geometry = instanced
      ? new THREE.InstancedBufferGeometry()
      : new THREE.BufferGeometry();

    geometry.name = source.name;
    vertexLayout?.elements.forEach(element => {
      const { name, slot } = element;
      const dataBuffer = source.getVertexBuffers()[slot] as GPUBufferThree | null;
      const nativeBuffer = dataBuffer?.resource;

      if (!(nativeBuffer instanceof THREE.InterleavedBuffer)) {
        return;
      }
      const bytesPerElement = (nativeBuffer.array as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT;

      // Three.js expresses stride and offset in backing-array elements.
      nativeBuffer.stride = vertexLayout.getStride(slot) / bytesPerElement;
      nativeBuffer.count = nativeBuffer.array.length / nativeBuffer.stride;
      geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(
        nativeBuffer,
        element.size,
        element.byteOffset / bytesPerElement,
        element.normalized,
      ));
    });
    const indexGPUBuffer = indexBuffer as GPUBufferThree | undefined;
    const nativeIndex = indexGPUBuffer?.resource;

    if (nativeIndex instanceof THREE.BufferAttribute) {
      geometry.setIndex(nativeIndex);
    }
    cache = { vertexLayout, indexBuffer, instanced, resource: geometry };
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
  vertexLayout: GPUVertexLayout | undefined,
  indexBuffer: GPUBuffer | undefined,
  instanced: boolean,
): boolean {
  if (cache.indexBuffer !== indexBuffer
    || cache.resource.index !== ((indexBuffer as GPUBufferThree | undefined)?.resource ?? null)
    || cache.instanced !== instanced
    || cache.vertexLayout !== vertexLayout
    || Object.keys(cache.resource.attributes).length !== (vertexLayout?.elements.length ?? 0)) {
    return false;
  }

  return vertexLayout?.elements.every(element => {
    const buffer = source.getVertexBuffers()[element.slot] as GPUBufferThree | null;
    const attribute = cache.resource.getAttribute(element.name);

    return attribute instanceof THREE.InterleavedBufferAttribute
      && attribute.data === buffer?.resource;
  }) ?? true;
}

/** Releases only the native geometries created for this display object's engine. */
export function disposeThreeGeometries (engine: Engine): void {
  const geometryCache = geometryCaches.get(engine);

  geometryCache?.forEach(cache => cache.resource.dispose());
  geometryCaches.delete(engine);
}
