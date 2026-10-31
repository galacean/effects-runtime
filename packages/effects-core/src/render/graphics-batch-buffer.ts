import type { Engine } from '../engine';
import { Geometry } from './geometry';
import { BufferUsage } from './gpu-buffer';

type BatchAttribute = {
  name: string,
  size: number,
  source: number[],
};

type AttributeBuffer = BatchAttribute & {
  data: Float32Array,
  view: Float32Array,
};

/** Reuses CPU storage and GPU allocations across ordered drawing batches. */
export class GraphicsBatchBuffer {
  static readonly maxVertices = 65535;
  readonly geometry: Geometry;
  vertexCount = 0;
  indexCount = 0;
  private vertexCapacity = 0;
  private indices = new Uint16Array(0);
  private indexView = this.indices;
  private readonly attributes: AttributeBuffer[];

  constructor (private readonly engine: Engine, attributes: BatchAttribute[], private readonly sourceIndices: number[]) {
    this.attributes = attributes.map(attribute => ({ ...attribute, data: new Float32Array(0), view: new Float32Array(0) }));
    this.geometry = Geometry.create(engine, {
      attributes: {}, bufferUsage: BufferUsage.Dynamic,
    });
  }

  append (): void {
    const vertexOffset = this.vertexCount;
    const vertices = this.attributes[0].source.length / this.attributes[0].size;
    const vertexCount = vertexOffset + vertices;
    const indexCount = this.indexCount + this.sourceIndices.length;

    if (vertexCount > this.vertexCapacity) {
      this.vertexCapacity = growCapacity(this.vertexCapacity, vertexCount);
      for (const attribute of this.attributes) {
        const data = new Float32Array(this.vertexCapacity * attribute.size);

        data.set(attribute.data); attribute.data = data;
      }
    }
    if (indexCount > this.indices.length) {
      const indices = new Uint16Array(growCapacity(this.indices.length, indexCount));

      indices.set(this.indices); this.indices = indices;
    }
    for (const attribute of this.attributes) {
      attribute.data.set(attribute.source, vertexOffset * attribute.size);
    }
    for (let index = 0; index < this.sourceIndices.length; index++) {
      this.indices[this.indexCount + index] = vertexOffset + this.sourceIndices[index];
    }
    this.vertexCount = vertexCount; this.indexCount = indexCount;
  }

  upload (): void {
    if (this.indexCount === 0) { return; }
    const device = this.engine.displayServer.renderingDevice;

    for (const attribute of this.attributes) {
      const buffer = this.geometry.getAttributeBuffer(attribute.name);

      if (!buffer || buffer.capacity < attribute.data.byteLength) {
        this.geometry.setAttribute(attribute.name, { data: attribute.data, size: attribute.size }, BufferUsage.Dynamic);
      } else {
        const length = this.vertexCount * attribute.size;

        if (attribute.view.buffer !== attribute.data.buffer || attribute.view.length !== length) {
          attribute.view = attribute.data.subarray(0, length);
        }
        // Storage and layout stay unchanged; only the retained contents need uploading.
        device.updateDynamicVertexBuffer(buffer, attribute.view);
      }
    }
    if (this.geometry.getIndexData() !== this.indices) {
      this.geometry.setIndexData(this.indices);
    } else {
      const buffer = this.geometry.getIndexBuffer();

      if (buffer) {
        if (this.indexView.buffer !== this.indices.buffer || this.indexView.length !== this.indexCount) {
          this.indexView = this.indices.subarray(0, this.indexCount);
        }
        device.updateDynamicIndexBuffer(buffer, this.indexView);
      }
    }
  }

  clear (): void { this.vertexCount = 0; this.indexCount = 0; }
  dispose (): void { this.geometry.dispose(); }
}

function growCapacity (capacity: number, required: number): number {
  return Math.max(256, capacity * 2, 2 ** Math.ceil(Math.log2(required)));
}
