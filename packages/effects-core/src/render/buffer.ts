import type * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import type { Disposable } from '../utils';
import type { DataBuffer, DataBufferKind } from './data-buffer';
import { BufferDataType, BufferUsage, getDataType } from './data-buffer';

export interface BufferProps {
  data?: spec.TypedArray,
  kind?: DataBufferKind,
  usage?: number,
  type?: number,
  byteStride?: number,
  instanceDivisor?: number,
  releasable?: boolean,
  name?: string,
}

type DirtyRange = {
  discard: boolean,
  start: number,
  end: number,
};

/**
 * 管理一份 CPU 数据及其对应的后端缓冲区。
 */
export class Buffer implements Disposable {
  readonly kind: DataBufferKind;
  readonly usage: number;
  readonly type: number;
  readonly byteStride: number;
  readonly instanceDivisor: number;
  readonly releasable: boolean;
  readonly name?: string;

  private data?: spec.TypedArray;
  private dataBuffer?: DataBuffer;
  private references = 0;
  private dirty?: DirtyRange;
  private byteLength = 0;
  private destroyed = false;

  constructor (
    public readonly engine: Engine,
    props: BufferProps = {},
  ) {
    const data = props.data;

    this.kind = props.kind ?? 'vertex';
    this.usage = props.usage ?? BufferUsage.Static;
    this.type = props.type ?? (data ? getDataType(data) : BufferDataType.Float);
    this.byteStride = props.byteStride ?? 0;
    this.instanceDivisor = props.instanceDivisor ?? 0;
    this.releasable = props.releasable ?? false;
    this.name = props.name;
    this.data = data;
    this.byteLength = data?.byteLength ?? 0;
    if (data) {
      this.markDiscard();
    }
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  get capacity (): number {
    return this.dataBuffer?.capacity ?? this.byteLength;
  }

  getData (): spec.TypedArray | undefined {
    return this.data;
  }

  getDataBuffer (): DataBuffer | undefined {
    return this.dataBuffer;
  }

  retain (): this {
    if (this.destroyed) {
      throw new Error('Cannot retain a disposed buffer.');
    }
    this.references++;

    return this;
  }

  release (): void {
    if (this.references > 0) {
      this.references--;
    }
    if (this.references === 0) {
      this.dispose();
    }
  }

  setData (data: spec.TypedArray): void {
    if (this.destroyed) {
      return;
    }
    this.data = data;
    this.byteLength = data.byteLength;
    this.markDiscard();
  }

  setSubData (elementOffset: number, data: spec.TypedArray): void {
    const target = this.data;

    if (!target) {
      throw new Error(`Buffer '${this.name ?? ''}' has no writable CPU data.`);
    }
    if (elementOffset < 0 || elementOffset + data.length > target.length) {
      throw new RangeError(`Buffer '${this.name ?? ''}' update is out of range.`);
    }
    target.set(data, elementOffset);
    if (!this.dirty?.discard) {
      const start = elementOffset;
      const end = elementOffset + data.length;

      if (this.dirty) {
        this.dirty.start = Math.min(this.dirty.start, start);
        this.dirty.end = Math.max(this.dirty.end, end);
      } else {
        this.dirty = { discard: false, start, end };
      }
    }
  }

  initialize (): void {
    if (this.destroyed || this.dataBuffer) {
      return;
    }
    this.dataBuffer = this.engine.createDataBuffer({
      kind: this.kind,
      usage: this.usage,
      type: this.type,
      byteStride: this.byteStride,
      instanceDivisor: this.instanceDivisor,
      name: this.name,
    });
    this.dataBuffer.references++;
    if (!this.dirty) {
      this.markDiscard();
    }
  }

  flush (): void {
    if (this.destroyed) {
      return;
    }
    this.initialize();
    const dataBuffer = this.dataBuffer;
    const dirty = this.dirty;

    if (!dataBuffer || !dirty) {
      return;
    }
    const data = this.data;

    if (dirty.discard) {
      dataBuffer.setData(data ?? this.byteLength);
    } else if (data && dirty.end > dirty.start) {
      const subData = createSubArray(data, dirty.start, dirty.end);

      dataBuffer.setSubData(dirty.start * data.BYTES_PER_ELEMENT, subData);
    }
    this.dirty = undefined;
    if (this.releasable && this.engine.doNotHandleContextLost) {
      this.data = undefined;
    }
  }

  restore (): void {
    if (!this.dataBuffer || this.destroyed) {
      return;
    }
    this.dataBuffer.restore(this.data, this.byteLength);
  }

  readSubData (elementOffset: number, destination: spec.TypedArray): boolean {
    const reader = this.dataBuffer as DataBuffer & {
      readSubData?: (elementOffset: number, destination: spec.TypedArray) => boolean,
    };

    return reader?.readSubData?.(elementOffset, destination) ?? false;
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    if (this.dataBuffer) {
      this.dataBuffer.references--;
      if (this.dataBuffer.references <= 0) {
        this.dataBuffer.dispose();
      }
    }
    this.data = undefined;
    this.dataBuffer = undefined;
    this.dirty = undefined;
    this.destroyed = true;
  }

  private markDiscard (): void {
    this.dirty = {
      discard: true,
      start: 0,
      end: this.data?.length ?? 0,
    };
  }
}

function createSubArray (data: spec.TypedArray, start: number, end: number): spec.TypedArray {
  const Constructor = data.constructor as {
    new (buffer: ArrayBufferLike, byteOffset: number, length: number): spec.TypedArray,
  };

  return new Constructor(
    data.buffer,
    data.byteOffset + start * data.BYTES_PER_ELEMENT,
    end - start,
  );
}
