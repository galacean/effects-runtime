import type * as spec from '@galacean/effects-specification';

export type DataArray = number[] | ArrayBuffer | ArrayBufferView;

export type IndicesArray = number[] | Int32Array | Uint32Array | Uint16Array;

export type IndexData = Int32Array | Uint32Array | Uint16Array;

export enum BufferUsage {
  Stream = 0x88E0,
  Static = 0x88E4,
  Dynamic = 0x88E8,
}

export enum BufferDataType {
  Byte = 0x1400,
  UnsignedByte = 0x1401,
  Short = 0x1402,
  UnsignedShort = 0x1403,
  Int = 0x1404,
  UnsignedInt = 0x1405,
  Float = 0x1406,
}

export interface DataBufferOptions {
  usage: number,
  type: number,
  byteStride: number,
  instanceDivisor: number,
  label?: string,
}

/**
 * 后端缓冲区的最小抽象，只保存资源状态。
 */
export class DataBuffer {
  references = 0;
  capacity = 0;
  is32Bits = false;

  get underlyingResource (): unknown {
    return null;
  }
}

export function getBytesPerElement (type: number): number {
  switch (type as BufferDataType) {
    case BufferDataType.Byte:
    case BufferDataType.UnsignedByte:
      return 1;
    case BufferDataType.Short:
    case BufferDataType.UnsignedShort:
      return 2;
    case BufferDataType.Int:
    case BufferDataType.UnsignedInt:
    case BufferDataType.Float:
      return 4;
    default:
      return 0;
  }
}

export function getDataType (data: DataArray): BufferDataType {
  if (data instanceof Int8Array) {
    return BufferDataType.Byte;
  }
  if (data instanceof Uint8Array) {
    return BufferDataType.UnsignedByte;
  }
  if (data instanceof Int16Array) {
    return BufferDataType.Short;
  }
  if (data instanceof Uint16Array) {
    return BufferDataType.UnsignedShort;
  }
  if (data instanceof Int32Array) {
    return BufferDataType.Int;
  }
  if (data instanceof Uint32Array) {
    return BufferDataType.UnsignedInt;
  }

  return BufferDataType.Float;
}

export function getDataByteLength (data: DataArray): number {
  if (Array.isArray(data)) {
    return data.length * Float32Array.BYTES_PER_ELEMENT;
  }

  return data.byteLength;
}

export function toBufferView (data: DataArray): ArrayBufferView {
  if (Array.isArray(data)) {
    return new Float32Array(data);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return data;
}

export function createTypedArray (type: number, length: number): spec.TypedArray {
  switch (type as BufferDataType) {
    case BufferDataType.Byte:
      return new Int8Array(length);
    case BufferDataType.UnsignedByte:
      return new Uint8Array(length);
    case BufferDataType.Short:
      return new Int16Array(length);
    case BufferDataType.UnsignedShort:
      return new Uint16Array(length);
    case BufferDataType.Int:
      return new Int32Array(length);
    case BufferDataType.UnsignedInt:
      return new Uint32Array(length);
    default:
      return new Float32Array(length);
  }
}
