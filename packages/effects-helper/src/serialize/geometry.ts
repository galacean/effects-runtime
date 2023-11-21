import { spec } from '@galacean/effects';
import type { GeometryProps } from '@galacean/effects';
import { concatBuffers, getBinaryType } from './utils';

export interface GeometrySerializationResult {
  version: '1.0',
  // 所有的 geometry 中数据会被写入到 data 中，
  // 写入时会去除重复的 typedArray，减少数据冗余
  data: ArrayBuffer,
  geometries: spec.GeometryOptionsJSON[],
}

/**
 * geometry 序列化
 * @param geometries
 */
export function serializeGeometries (geometries: GeometryProps[]): GeometrySerializationResult {
  const buffers: spec.TypedArray[] = [];
  const bufferInfo: Map<spec.TypedArray, spec.BinaryPointerContent> = new Map();
  let offset = 0;

  geometries.forEach(options => {
    addBuffer(options.indices?.data);
    Object.values(options.attributes).forEach(attribute => {
      const { data } = attribute as spec.AttributeWithData;

      addBuffer(data);
    });
  });

  const resultBuffer = concatBuffers(buffers, bufferInfo, offset);
  const mappedGeometries: spec.GeometryOptionsJSON[] = geometries.map(props => {
    const geometryProps = { ...props } as spec.GeometryOptionsJSON;

    if (geometryProps.indices) {
      geometryProps.indices = replaceAttribute(geometryProps.indices);
    }
    geometryProps.attributes = {};

    Object.keys(props.attributes).forEach(name => {
      const attribute = props.attributes[name];

      geometryProps.attributes[name] = replaceAttribute(attribute);
    });

    return geometryProps;
  });

  return {
    data: resultBuffer,
    geometries: mappedGeometries,
    version: '1.0',
  };

  function addBuffer (buffer?: spec.TypedArray) {
    if (buffer && !buffers.includes(buffer)) {
      buffers.push(buffer);
      bufferInfo.set(buffer, [0, offset, buffer.byteLength, getBinaryType(buffer)]);
      offset += buffer.byteLength;
      // padding 4bytes for f32
      offset = Math.ceil(offset / 4) * 4;
    }
  }

  function replaceAttribute (attr: Partial<spec.AttributeWithDataPointer | spec.AttributeWithData>) {
    let source: { data: spec.BinaryPointer } | undefined;

    if (attr.data) {
      const info = bufferInfo.get(attr.data as spec.TypedArray);

      if (info) {
        source = { data: [spec.ValueType.BINARY, info] };
      }
    }

    return { ...attr, ...source } as spec.AttributeWithData & { data: spec.BinaryPointer };
  }
}

/**
 * geometry 反序列化
 * @param geometryProps
 * @param data
 */
export function deserializeGeometry (
  geometryProps: spec.GeometryOptionsJSON,
  data: ArrayBuffer[],
): GeometryProps {
  const { attributes } = geometryProps;
  const ret = { ...geometryProps } as GeometryProps;

  if (ret.indices) {
    ret.indices = { ...ret.indices };
    if (ret.indices.data) {
      // @ts-expect-error
      ret.indices.data = typedArrayFromBinary(data, geometryProps.indices?.data) as Uint8Array;
    }
    // @ts-expect-error
  } else if (ret.index) {
    // FIXME: 兼容编辑器导出的旧版数据
    // @ts-expect-error
    ret.indices = { ...ret.index };
    // @ts-expect-error
    if (ret.indices.data) {
      // @ts-expect-error
      ret.indices.data = typedArrayFromBinary(data, geometryProps.index?.data) as Uint8Array;
    }
  }
  Object.keys(attributes).forEach(name => {
    const attribute = attributes[name];
    const { data: pointer } = attribute as spec.AttributeWithDataPointer;

    ret.attributes[name] = { ...attribute };
    if (pointer) {
      (ret.attributes[name] as spec.AttributeWithData).data = typedArrayFromBinary(data, pointer) as Float32Array;
    }
  });

  return ret;
}

const ctrlMap: Record<string, Float32ArrayConstructor | Uint8ArrayConstructor | Int8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor> = {
  i8: Int8Array,
  u8: Uint8Array,
  i16: Int16Array,
  u16: Uint16Array,
  f32: Float32Array,
  i32: Int32Array,
  u32: Uint32Array,
};

/**
 * 重构 TypedArray，返回的 TypedArray 如果修改，会反映到原始的 ArrayBuffer 中
 * @param binaries
 * @param pointer
 */
export function typedArrayFromBinary (binary: ArrayBuffer[], pointer: spec.BinaryPointer): spec.TypedArray | ArrayBuffer {
  if (pointer.length != 2 || pointer[0] !== spec.ValueType.BINARY || !(pointer[1] instanceof Array)) {
    // 不是BinaryPointer，可能已经创建，直接返回
    return pointer as unknown as ArrayBuffer;
  }

  const [index, start, byteLength, type] = pointer[1] as Required<spec.BinaryPointerContent>;

  if (!type) {
    return binary[index].slice(start, byteLength);
  }

  const CTRL = ctrlMap[type] || Uint8Array;

  return new CTRL(binary[index], start, byteLength / CTRL.BYTES_PER_ELEMENT);
}
