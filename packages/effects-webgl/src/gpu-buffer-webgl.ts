import type { GPUBufferDescription, IndicesArray } from '@galacean/effects-core';
import { GPUBuffer, toBufferView } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from './rendering-device-webgl';
import { assignInspectorName } from './debug-utils';

export class GPUBufferWebGL extends GPUBuffer {
  private buffer: WebGLBuffer | null = null;

  override get underlyingResource (): WebGLBuffer | null {
    return this.buffer;
  }

  protected override onInitialize (description: GPUBufferDescription): void {
    const device = this.device as RenderingDeviceWebGL;
    const gl = device.gl;
    const { data, index, usage, label } = description;
    const view = index ? this.normalizeIndexData(data)
      : typeof data === 'number' ? undefined : toBufferView(data);
    const byteLength = typeof data === 'number' ? data : view!.byteLength;
    const target = index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const resource = gl.createBuffer();

    if (!resource) {
      throw new Error(`Failed to create buffer. gl isContextLost=${gl.isContextLost()}`);
    }
    this.buffer = resource;
    assignInspectorName(resource, label);
    if (index) {
      device.bindIndexBuffer(this);
    } else {
      device.bindArrayBuffer(this);
    }
    gl.bufferData(target, Math.max(byteLength, 1), usage);
    if (view && byteLength > 0) {
      gl.bufferSubData(target, 0, view);
    }
    if (index) {
      device.bindIndexBuffer(null);
    } else {
      device.bindArrayBuffer(null);
    }
    this.capacity = byteLength;
    this.is32Bits = !!index && view instanceof Uint32Array;
  }

  protected override onReleaseGPU (): void {
    const device = this.device as RenderingDeviceWebGL;

    device.invalidateBuffer(this);
    if (!device.gl.isContextLost()) {
      device.gl.deleteBuffer(this.buffer);
    }
    this.buffer = null;
    super.onReleaseGPU();
  }

  private normalizeIndexData (indices: IndicesArray): Uint16Array | Uint32Array {
    if (indices instanceof Uint16Array) {
      return indices;
    }
    const { gpuCapability } = this.device as RenderingDeviceWebGL;
    const supports32Bits = gpuCapability.isWebGL2 || gpuCapability.detail.intIndexElementBuffer;

    if (supports32Bits) {
      if (indices instanceof Uint32Array) {
        return indices;
      }
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] >= 65535) {
          return new Uint32Array(indices);
        }
      }
    }

    return new Uint16Array(indices);
  }
}
