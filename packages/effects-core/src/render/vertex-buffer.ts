import type * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import type { Disposable } from '../utils';
import { Buffer } from './buffer';
import type { DataArray, DataBuffer } from './data-buffer';
import { BufferDataType, getBytesPerElement, getDataType } from './data-buffer';

export interface VertexBufferProps {
  updatable?: boolean,
  postponeInternalCreation?: boolean,
  stride?: number,
  instanced?: boolean,
  offset?: number,
  size?: number,
  type?: number,
  normalized?: boolean,
  useBytes?: boolean,
  divisor?: number,
  takeBufferOwnership?: boolean,
  label?: string,
}

/**
 * 描述一个顶点属性如何读取共享缓冲区。
 */
export class VertexBuffer implements Disposable {
  static readonly PositionKind = 'aPos';
  static readonly NormalKind = 'aNormal';
  static readonly TangentKind = 'aTangent';
  static readonly UVKind = 'aUV';
  static readonly UV2Kind = 'aUV2';
  static readonly UV3Kind = 'aUV3';
  static readonly UV4Kind = 'aUV4';
  static readonly UV5Kind = 'aUV5';
  static readonly UV6Kind = 'aUV6';
  static readonly ColorKind = 'aColor';
  static readonly JointsKind = 'aJoints';
  static readonly WeightsKind = 'aWeights';

  static readonly BYTE = BufferDataType.Byte;
  static readonly UNSIGNED_BYTE = BufferDataType.UnsignedByte;
  static readonly SHORT = BufferDataType.Short;
  static readonly UNSIGNED_SHORT = BufferDataType.UnsignedShort;
  static readonly INT = BufferDataType.Int;
  static readonly UNSIGNED_INT = BufferDataType.UnsignedInt;
  static readonly FLOAT = BufferDataType.Float;

  readonly byteStride: number;
  readonly byteOffset: number;
  readonly normalized: boolean;
  readonly type: spec.BufferType;
  readonly engine: Engine;

  /**
   * @internal
   */
  readonly buffer: Buffer;
  /**
   * @internal
   */
  readonly ownsBuffer: boolean;

  private readonly kind: string;
  private readonly size: number;
  private _isDisposed = false;
  private instanced: boolean;
  private _instanceDivisor: number;

  constructor (
    engine: Engine,
    data: DataArray | Buffer | DataBuffer,
    kind: string,
    props: VertexBufferProps = {},
  ) {
    this.engine = engine;
    this.kind = kind;

    if (data instanceof Buffer) {
      this.buffer = data;
      this.ownsBuffer = props.takeBufferOwnership ?? false;
    } else {
      this.buffer = new Buffer(
        engine,
        data,
        props.updatable ?? false,
        props.stride ?? 0,
        props.postponeInternalCreation ?? false,
        props.instanced ?? false,
        props.useBytes ?? false,
        props.divisor,
        props.label,
      );
      this.ownsBuffer = true;
    }

    const source = this.getData();

    this.type = (props.type ?? (source ? getDataType(source) : VertexBuffer.FLOAT)) as spec.BufferType;
    const typeByteLength = getBytesPerElement(this.type);
    const useBytes = props.useBytes ?? false;
    const stride = props.stride ?? 0;
    const offset = props.offset ?? 0;

    if (useBytes) {
      this.size = props.size || (stride ? stride / typeByteLength : 0);
      this.byteStride = stride || this.buffer.byteStride || this.size * typeByteLength;
      this.byteOffset = offset;
    } else {
      this.size = props.size || stride;
      this.byteStride = stride
        ? stride * typeByteLength
        : this.buffer.byteStride || this.size * typeByteLength;
      this.byteOffset = offset * typeByteLength;
    }
    this.normalized = props.normalized ?? false;
    this.instanced = props.instanced ?? false;
    this._instanceDivisor = this.instanced ? props.divisor ?? 1 : 0;
  }

  get isDisposed (): boolean {
    return this._isDisposed;
  }

  get instanceDivisor (): number {
    return this._instanceDivisor;
  }

  set instanceDivisor (value: number) {
    this._instanceDivisor = value;
    this.instanced = value !== 0;
  }

  getKind (): string {
    return this.kind;
  }

  isUpdatable (): boolean {
    return this.buffer.isUpdatable();
  }

  getData (): DataArray | undefined {
    return this.buffer.getData();
  }

  getBuffer (): DataBuffer | undefined {
    return this.buffer.getBuffer();
  }

  getWrapperBuffer (): Buffer {
    return this.buffer;
  }

  getStrideSize (): number {
    return this.byteStride / getBytesPerElement(this.type);
  }

  getOffset (): number {
    return this.byteOffset / getBytesPerElement(this.type);
  }

  getSize (sizeInBytes = false): number {
    return sizeInBytes ? this.size * getBytesPerElement(this.type) : this.size;
  }

  getIsInstanced (): boolean {
    return this.instanced;
  }

  getInstanceDivisor (): number {
    return this._instanceDivisor;
  }

  create (data?: DataArray): void {
    this.buffer.create(data);
  }

  update (data: DataArray): void {
    this.buffer.update(data);
  }

  updateDirectly (data: DataArray, offset: number, useBytes = false): void {
    this.buffer.updateDirectly(data, offset, undefined, useBytes);
  }

  /**
   * @internal
   */
  rebuild (): void {
    this.buffer.rebuild();
  }

  dispose (): void {
    if (this.ownsBuffer) {
      this.buffer.dispose();
    }
    this._isDisposed = true;
  }
}
