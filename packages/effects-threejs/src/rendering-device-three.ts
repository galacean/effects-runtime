import type {
  Composition, GPUBuffer, IndicesArray, spec,
} from '@galacean/effects-core';
import {
  BufferDataType, RenderingData, RenderingDevice, GPUCapability,
} from '@galacean/effects-core';
import type * as THREE from 'three';
import { GPUBufferThree, toTypedArray } from './gpu-buffer-three';
import { GPUTextureThree } from './gpu-texture-three';

export interface RenderingDeviceThreeOptions {
  threeCamera?: THREE.Camera,
  composition: Composition,
  threeGroup: THREE.Group,
}

type BufferData = number[] | ArrayBuffer | ArrayBufferView;

/** Adapts effects buffers and scene bindings to the host Three.js renderer. */
export class RenderingDeviceThree extends RenderingDevice {
  threeCamera?: THREE.Camera;
  threeGroup: THREE.Group;
  composition: Composition;

  /** The host supplies its context after Engine construction, keeping canvas sizing with Three.js. */
  setContext (context: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.gpuCapability = new GPUCapability(context);
  }

  override getWidth (): number {
    return this.engine.canvas.width;
  }

  override getHeight (): number {
    return this.engine.canvas.height;
  }

  setOptions (options: RenderingDeviceThreeOptions) {
    const { threeCamera, threeGroup, composition } = options;

    this.threeCamera = threeCamera;
    this.threeGroup = threeGroup;
    this.composition = composition;
  }

  renderComposition (composition: Composition): void {
    const { engine } = this;
    const { renderer } = engine;
    const previousData = renderer.renderingData;
    const previousComposition = this.composition;
    const data = new RenderingData({
      camera: composition.camera,
      target: null,
      globalVolume: composition.globalVolume,
      postProcessingEnabled: false,
    });

    renderer.renderingData = data;
    this.composition = composition;
    try {
      renderer.prepareRenderingData(composition.sceneRendering, data);
      renderer.renderMeshes(data.renderList.objects);
    } finally {
      data.frameData.dispose();
      renderer.renderingData = previousData;
      this.composition = previousComposition;
    }
  }

  override createTexture (): GPUTextureThree {
    return new GPUTextureThree(this);
  }

  override createBuffer (): GPUBufferThree {
    return new GPUBufferThree(this);
  }

  override updateDynamicVertexBuffer (
    vertexBuffer: GPUBuffer,
    data: BufferData,
    byteOffset = 0,
    byteLength?: number,
  ): void {
    let view = toTypedArray(data, BufferDataType.Float);

    if (byteLength !== undefined && byteLength < view.byteLength) {
      view = new Uint8Array(view.buffer, view.byteOffset, byteLength);
    }
    const resource = (vertexBuffer as GPUBufferThree).resource;

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
    indexBuffer: GPUBuffer,
    indices: IndicesArray,
    byteOffset = 0,
  ): void {
    const data = indexBuffer.is32Bits
      ? indices instanceof Uint32Array ? indices : new Uint32Array(indices)
      : indices instanceof Uint16Array ? indices : new Uint16Array(indices);

    const resource = (indexBuffer as GPUBufferThree).resource;

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
}
