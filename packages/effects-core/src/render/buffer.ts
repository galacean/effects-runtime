import type { Engine } from '../engine';
import type { Disposable } from '../utils';
import type { DataArray, DataBufferOptions } from './data-buffer';
import {
  BufferDataType, BufferUsage, DataBuffer, getDataByteLength, getDataType,
} from './data-buffer';
import { VertexBuffer } from './vertex-buffer';

/**
 * 管理顶点数据及其对应的后端缓冲区。
 */
export class Buffer implements Disposable {
  readonly byteStride: number;

  private data?: DataArray;
  private buffer?: DataBuffer;
  private readonly updatable: boolean;
  private readonly instanced: boolean;
  private readonly divisor: number;
  private readonly label?: string;
  private isAlreadyOwned = false;
  private _isDisposed = false;

  constructor (
    public readonly engine: Engine,
    data: DataArray | DataBuffer,
    updatable: boolean,
    stride = 0,
    postponeInternalCreation = false,
    instanced = false,
    useBytes = false,
    divisor?: number,
    label?: string,
  ) {
    this.updatable = updatable;
    this.instanced = instanced;
    this.divisor = divisor || 1;
    this.label = label;
    this.byteStride = useBytes ? stride : stride * Float32Array.BYTES_PER_ELEMENT;

    if (data instanceof DataBuffer) {
      this.buffer = data;
    } else {
      this.data = data;
    }
    if (!postponeInternalCreation) {
      this.create();
    }
  }

  get isDisposed (): boolean {
    return this._isDisposed;
  }

  get capacity (): number {
    return this.buffer?.capacity ?? (this.data ? getDataByteLength(this.data) : 0);
  }

  isUpdatable (): boolean {
    return this.updatable;
  }

  getData (): DataArray | undefined {
    return this.data;
  }

  getBuffer (): DataBuffer | undefined {
    return this.buffer;
  }

  getStrideSize (): number {
    return this.byteStride / Float32Array.BYTES_PER_ELEMENT;
  }

  createVertexBuffer (
    kind: string,
    offset: number,
    size: number,
    stride?: number,
    instanced?: boolean,
    useBytes = false,
    divisor?: number,
  ): VertexBuffer {
    const byteOffset = useBytes ? offset : offset * Float32Array.BYTES_PER_ELEMENT;
    const byteStride = stride
      ? (useBytes ? stride : stride * Float32Array.BYTES_PER_ELEMENT)
      : this.byteStride;

    return new VertexBuffer(this.engine, this, kind, {
      size,
      stride: byteStride,
      offset: byteOffset,
      instanced: instanced === undefined ? this.instanced : instanced,
      useBytes: true,
      divisor: divisor ?? this.divisor,
    });
  }

  create (data?: DataArray): void {
    if (!data && this.buffer) {
      return;
    }
    data = data ?? this.data;
    if (!data) {
      return;
    }
    const options = this.getDataBufferOptions(data);

    if (!this.buffer) {
      this.buffer = this.updatable
        ? this.engine.createDynamicVertexBuffer(data, options)
        : this.engine.createVertexBuffer(data, options);
      if (this.updatable) {
        this.data = data;
      }
    } else if (this.updatable) {
      this.engine.updateDynamicVertexBuffer(this.buffer, data);
      this.data = data;
    }
  }

  update (data: DataArray): void {
    this.create(data);
  }

  updateDirectly (
    data: DataArray,
    offset: number,
    vertexCount?: number,
    useBytes = false,
  ): void {
    if (!this.buffer || !this.updatable) {
      return;
    }
    this.engine.updateDynamicVertexBuffer(
      this.buffer,
      data,
      useBytes ? offset : offset * Float32Array.BYTES_PER_ELEMENT,
      vertexCount ? vertexCount * this.byteStride : undefined,
    );
    if (offset === 0 && vertexCount === undefined) {
      this.data = data;
    } else {
      this.data = undefined;
    }
  }

  /**
   * @internal
   */
  rebuild (): void {
    if (!this.data) {
      if (!this.buffer) {
        return;
      }
      const capacity = this.buffer.capacity;

      if (capacity > 0) {
        const options = this.getDataBufferOptions();

        this.buffer = this.updatable
          ? this.engine.createDynamicVertexBuffer(capacity, options)
          : this.engine.createVertexBuffer(capacity, options);
      } else {
        this.buffer = undefined;
      }

      return;
    }
    this.buffer = undefined;
    this.create(this.data);
  }

  /**
   * @internal
   */
  increaseReferences (): void {
    if (!this.buffer) {
      return;
    }
    if (!this.isAlreadyOwned) {
      this.isAlreadyOwned = true;

      return;
    }
    this.buffer.references++;
  }

  dispose (): void {
    if (!this.buffer) {
      return;
    }
    if (this.engine.releaseBuffer(this.buffer)) {
      this.data = undefined;
      this.buffer = undefined;
      this._isDisposed = true;
    }
  }

  private getDataBufferOptions (data?: DataArray): DataBufferOptions {
    return {
      usage: this.updatable ? BufferUsage.Dynamic : BufferUsage.Static,
      type: data ? getDataType(data) : BufferDataType.Float,
      byteStride: this.byteStride,
      instanceDivisor: this.instanced ? this.divisor : 0,
      label: this.label,
    };
  }
}
