import type * as spec from '@galacean/effects-specification';
import type { Disposable } from '../utils';
import type { Buffer } from './buffer';
import { getBytesPerElement } from './data-buffer';

export interface VertexBufferProps {
  size: number,
  type: number,
  dataSource: string,
  byteStride?: number,
  byteOffset?: number,
  normalized?: boolean,
  instanceDivisor?: number,
}

/**
 * 描述一个顶点属性如何读取共享缓冲区。
 */
export class VertexBuffer implements Disposable {
  readonly size: number;
  readonly type: spec.BufferType;
  readonly dataSource: string;
  readonly byteStride: number;
  readonly byteOffset: number;
  readonly normalized: boolean;
  readonly instanceDivisor: number;

  constructor (
    public readonly name: string,
    public readonly buffer: Buffer,
    props: VertexBufferProps,
  ) {
    this.size = props.size;
    this.type = props.type as spec.BufferType;
    this.dataSource = props.dataSource;
    this.byteStride = props.byteStride ?? props.size * getBytesPerElement(props.type);
    this.byteOffset = props.byteOffset ?? 0;
    this.normalized = props.normalized ?? false;
    this.instanceDivisor = props.instanceDivisor ?? 0;
    this.buffer.retain();
  }

  get stride (): number {
    return this.byteStride;
  }

  get offset (): number {
    return this.byteOffset;
  }

  get normalize (): boolean {
    return this.normalized;
  }

  getData (): spec.TypedArray | undefined {
    return this.buffer.getData();
  }

  createReference (name = this.name): VertexBuffer {
    return new VertexBuffer(name, this.buffer, {
      size: this.size,
      type: this.type,
      dataSource: this.dataSource,
      byteStride: this.byteStride,
      byteOffset: this.byteOffset,
      normalized: this.normalized,
      instanceDivisor: this.instanceDivisor,
    });
  }

  dispose (): void {
    this.buffer.release();
  }
}
