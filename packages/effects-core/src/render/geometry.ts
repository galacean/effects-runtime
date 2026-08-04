import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import { EffectsObject } from '../effects-object';
import { Buffer } from './buffer';
import type { DataBuffer, IndexData, IndicesArray } from './data-buffer';
import {
  BufferDataType, BufferUsage, createTypedArray, getBytesPerElement, getDataType,
} from './data-buffer';
import { VertexBuffer } from './vertex-buffer';
import type { ShaderVariant } from './shader';

export type GeometryDrawMode = number;

export type Attribute =
  | spec.AttributeWithData
  | spec.AttributeWithDataPointer
  | spec.AttributeWithType
  | spec.AttributeWithDataSource
  ;

export interface GeometryProps {
  name?: string,
  attributes: Record<string, Attribute>,
  indices?: { data: IndexData },
  mode?: GeometryDrawMode,
  drawCount?: number,
  drawStart?: number,
  instanceCount?: number,
  /**
   * 顶点和索引缓冲区的使用方式，默认使用静态缓冲区。
   */
  bufferUsage?: number,
  /**
   * 为初始空缓冲区预留的最大顶点数量。
   */
  maxVertex?: number,
}

export interface SkinProps {
  boneNames?: string[],
  rootBoneName?: string,
  inverseBindMatrices?: number[],
}

let geometryId = 1;

type VertexArrayObject = object;

interface VertexArrayObjectEngine {
  recordVertexArrayObject: (
    vertexBuffers: Record<string, VertexBuffer>,
    indexBuffer: DataBuffer | undefined,
    shader: ShaderVariant,
  ) => VertexArrayObject | undefined,
  bindVertexArrayObject: (
    vertexArrayObject: VertexArrayObject,
    indexBuffer: DataBuffer | undefined,
  ) => void,
  releaseVertexArrayObject: (vertexArrayObject: VertexArrayObject) => void,
}

/**
 * 几何数据、属性布局和绘制范围的后端无关实现。
 */
export class Geometry extends EffectsObject {
  static create = (engine: Engine, props?: GeometryProps): Geometry => new Geometry(engine, props);

  name = '';
  subMeshes: spec.SubMesh[] = [];
  /** @hide */
  mode: GeometryDrawMode = 4;
  /** @hide */
  instanceCount = 0;

  private vertexBuffers: Record<string, VertexBuffer> = {};
  private indices: IndexData = new Uint16Array(0);
  private drawCount = 0;
  private drawStart = 0;
  private skin: SkinProps = {};
  private indexBuffer?: DataBuffer;
  private disposed = false;
  private initialized = false;
  private options?: GeometryProps;
  private bufferUsage = BufferUsage.Static;
  private vertexArrayObjects?: Record<string, VertexArrayObject>;

  /** @hide */
  constructor (engine: Engine, props?: GeometryProps) {
    super(engine);
    if (supportsVertexArrayObjects(engine)) {
      this.vertexArrayObjects = {};
    }
    if (props) {
      this.processProps(props);
    }
  }

  /** @hide */
  isDisposed (): boolean {
    return this.disposed;
  }

  /**
   * @internal
   */
  get isInitialized (): boolean {
    return this.initialized;
  }

  /**
   * @internal
   */
  getOptions (): GeometryProps | undefined {
    return this.options ? { ...this.options } : undefined;
  }

  /** @hide */
  getVertexBuffer (name: string): VertexBuffer | undefined {
    return this.vertexBuffers[name];
  }

  /**
   * @internal
   */
  getVertexBuffers (): Readonly<Record<string, VertexBuffer>> {
    return this.vertexBuffers;
  }

  /** @hide */
  setVerticesBuffer (vertexBuffer: VertexBuffer): void {
    const kind = vertexBuffer.getKind();
    const current = this.vertexBuffers[kind];

    if (current === vertexBuffer) {
      return;
    }
    current?.dispose();
    if (vertexBuffer.ownsBuffer) {
      vertexBuffer.buffer.increaseReferences();
    }
    this.vertexBuffers[kind] = vertexBuffer;
    this.disposeVertexArrayObjects();
  }

  /** @hide */
  getAttributeBuffer (name: string): Buffer | undefined {
    return this.vertexBuffers[name]?.getWrapperBuffer();
  }

  getAttributeData (name: string): spec.TypedArray | undefined {
    return this.vertexBuffers[name]?.getData() as spec.TypedArray | undefined;
  }

  setAttributeData (name: string, data: spec.TypedArray): void {
    this.vertexBuffers[name]?.update(data);
  }

  setAttributeSubData (name: string, offset: number, data: spec.TypedArray): void {
    const vertexBuffer = this.vertexBuffers[name];

    if (!vertexBuffer) {
      return;
    }
    vertexBuffer.updateDirectly(data, offset);
  }

  getAttributeStride (name: string): number {
    return this.vertexBuffers[name]?.byteStride ?? 0;
  }

  getAttributeNames (): string[] {
    return Object.keys(this.vertexBuffers);
  }

  /** @hide */
  getIndexBuffer (): DataBuffer | undefined {
    return this.indexBuffer;
  }

  getIndexData (): IndexData {
    return this.indices;
  }

  /** @hide */
  getIndexType (): number {
    return this.indexBuffer?.is32Bits || shouldUse32Bits(this.indices)
      ? BufferDataType.UnsignedInt
      : BufferDataType.UnsignedShort;
  }

  setIndexData (data: IndicesArray): void {
    if (!isIndexData(data)) {
      throw new TypeError('Index data must use a supported integer array.');
    }

    this.indices = Array.isArray(data)
      ? shouldUse32Bits(data) ? new Uint32Array(data) : new Uint16Array(data)
      : data;
    this.releaseIndexBuffer();
    this.disposeVertexArrayObjects();
    if (this.initialized) {
      this.createIndexBuffer();
    }
  }

  setIndexSubData (offset: number, data: IndicesArray): void {
    const indices = this.indices;

    if (offset < 0 || offset + data.length > indices.length) {
      throw new RangeError(`Buffer '${this.name}##index' update is out of range.`);
    }
    indices.set(data, offset);
    if (this.indexBuffer) {
      const updatedData = indices.slice(offset, offset + data.length) as IndicesArray;

      this.engine.updateDynamicIndexBuffer(
        this.indexBuffer,
        updatedData,
        offset * (this.indexBuffer.is32Bits ? Uint32Array.BYTES_PER_ELEMENT : Uint16Array.BYTES_PER_ELEMENT),
      );
    }
  }

  setDrawStart (start: number): void {
    this.drawStart = start;
  }

  getDrawStart (): number {
    return this.drawStart;
  }

  setDrawCount (count: number): void {
    this.drawCount = count;
  }

  getDrawCount (): number {
    return this.drawCount;
  }

  getSkinProps (): SkinProps {
    return this.skin;
  }

  /** @hide */
  bind (shader: ShaderVariant): void {
    const vertexArrayObjects = this.vertexArrayObjects;
    const engine = this.engine;

    if (!vertexArrayObjects || !supportsVertexArrayObjects(engine)) {
      engine.bindBuffers(this.vertexBuffers, this.indexBuffer, shader);

      return;
    }
    let vertexArrayObject: VertexArrayObject | undefined = vertexArrayObjects[shader.key];

    if (!vertexArrayObject) {
      vertexArrayObject = engine.recordVertexArrayObject(
        this.vertexBuffers,
        this.indexBuffer,
        shader,
      );
      if (vertexArrayObject) {
        vertexArrayObjects[shader.key] = vertexArrayObject;
      }
    }
    if (vertexArrayObject) {
      engine.bindVertexArrayObject(vertexArrayObject, this.indexBuffer);
    } else {
      engine.bindBuffers(this.vertexBuffers, this.indexBuffer, shader);
    }
  }

  private releaseVertexArrayObject (key: string): void {
    const vertexArrayObjects = this.vertexArrayObjects;

    if (!vertexArrayObjects) {
      return;
    }
    const vertexArrayObject = vertexArrayObjects[key];

    if (vertexArrayObject && hasVertexArrayObjectMethods(this.engine)) {
      this.engine.releaseVertexArrayObject(vertexArrayObject);
    }
    delete vertexArrayObjects[key];
  }

  initialize (): void {
    if (this.initialized || this.disposed) {
      return;
    }
    this.forEachVertexBuffer(buffer => {
      buffer.create();
    });
    this.createIndexBuffer();
    this.engine.addGeometry(this);
    this.initialized = true;
    this.options = undefined;
  }

  flush (): void {
    if (this.disposed) {
      return;
    }
    this.initialize();
    this.forEachVertexBuffer(buffer => buffer.create());
  }

  /** @hide */
  restore (): void {
    if (!this.initialized || this.disposed) {
      return;
    }
    this.disposeVertexArrayObjects();
    this.forEachVertexBuffer(buffer => buffer.rebuild());
    if (this.indices.length > 0) {
      this.indexBuffer = undefined;
      this.createIndexBuffer();
    }
  }

  override fromData (data: spec.GeometryData): void {
    super.fromData(data);
    this.subMeshes = data.subMeshes;
    let buffer: Uint8Array | undefined;

    if (data.buffer) {
      buffer = new Uint8Array(decodeBase64ToArrayBuffer(data.buffer));
    } else if (data.binaryData) {
      buffer = data.binaryData;
    }
    if (!buffer) {
      return;
    }
    const vertexCount = data.vertexData.vertexCount;
    const props: GeometryProps = {
      name: data.name,
      mode: 4,
      attributes: {},
    };

    if (hasSemantic(data)) {
      data.vertexData.channels.forEach(channel => {
        const attributeName = vertexBufferSemanticMap[channel.semantic] ?? channel.semantic;

        props.attributes[attributeName] = {
          type: vertexFormatToDataType(channel.format),
          size: channel.dimension,
          data: createVertexTypedArray(channel, buffer, vertexCount),
          normalize: channel.normalize,
        };
      });
    } else {
      const positionChannel = data.vertexData.channels[0];
      const uvChannel = data.vertexData.channels[1];
      const normalChannel = data.vertexData.channels[2];

      props.attributes = {
        aPos: createAttributeFromChannel(positionChannel, buffer, vertexCount, 3),
        aUV: createAttributeFromChannel(uvChannel, buffer, vertexCount, 2),
        aNormal: createAttributeFromChannel(normalChannel, buffer, vertexCount, 3),
      };
    }
    if (data.indexFormat !== spec.IndexFormatType.None) {
      const indices = createIndexTypedArray(data.indexFormat, buffer, data.indexOffset);

      props.indices = { data: indices };
      props.drawCount = indices.length;
    } else {
      props.drawCount = vertexCount;
    }
    this.processProps(props);
    this.skin = {
      boneNames: data.boneNames,
      rootBoneName: data.rootBoneName,
      inverseBindMatrices: data.inverseBindMatrices,
    };
  }

  override dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposeVertexArrayObjects();
    Object.keys(this.vertexBuffers).forEach(name => this.vertexBuffers[name].dispose());
    this.releaseIndexBuffer();
    this.vertexBuffers = {};
    this.indices = new Uint16Array(0);
    this.options = undefined;
    this.drawStart = 0;
    this.drawCount = NaN;
    if (this.initialized) {
      this.engine.removeGeometry(this);
    }
    this.initialized = false;
    this.disposed = true;
    super.dispose();
  }

  private processProps (props: GeometryProps): void {
    this.releaseCurrentBuffers();
    const usage = props.bufferUsage ?? BufferUsage.Static;
    const sourceBuffers: Record<string, Buffer> = {};
    const sourceDivisors: Record<string, number> = {};
    const sourceTypes: Record<string, number> = {};

    Object.keys(props.attributes).forEach(name => {
      const attribute = props.attributes[name];
      const source = 'dataSource' in attribute ? attribute.dataSource : name;

      sourceDivisors[source] = Math.max(sourceDivisors[source] ?? 0, attribute.instanceDivisor ?? 0);
    });
    Object.keys(props.attributes).forEach(name => {
      const attribute = props.attributes[name];

      if ('dataSource' in attribute) {
        return;
      }
      const typedData = isTypedArray(attribute.data) ? attribute.data : undefined;
      const type = attribute.type ?? (typedData ? getDataType(typedData) : BufferDataType.Float);
      const bytesPerElement = getBytesPerElement(type);
      const byteStride = attribute.stride || attribute.size * bytesPerElement;
      let data = typedData ?? createTypedArray(type, 0);

      if (data.length === 0 && props.maxVertex && props.maxVertex > 0) {
        const elementStride = byteStride / bytesPerElement;

        data = createTypedArray(type, Math.ceil(props.maxVertex * elementStride));
      }
      const instanceDivisor = sourceDivisors[name] ?? 0;

      sourceTypes[name] = type;
      sourceBuffers[name] = new Buffer(
        this.engine,
        data,
        usage !== (BufferUsage.Static as number),
        byteStride,
        true,
        instanceDivisor > 0,
        true,
        instanceDivisor,
        name,
      );
    });
    Object.keys(props.attributes).forEach(name => {
      const attribute = props.attributes[name];
      const source = 'dataSource' in attribute ? attribute.dataSource : name;
      const buffer = sourceBuffers[source];

      if (!buffer) {
        throw new Error(`Attribute '${name}' references missing data source '${source}'.`);
      }
      const type = attribute.type ?? sourceTypes[source] ?? BufferDataType.Float;

      const byteStride = attribute.stride || buffer.byteStride;
      const instanceDivisor = attribute.instanceDivisor ?? 0;

      const vertexBuffer = new VertexBuffer(this.engine, buffer, name, {
        size: attribute.size,
        type,
        stride: byteStride,
        offset: attribute.offset ?? 0,
        normalized: attribute.normalize ?? false,
        instanced: instanceDivisor > 0,
        divisor: instanceDivisor,
        useBytes: true,
        takeBufferOwnership: true,
      });

      this.setVerticesBuffer(vertexBuffer);
    });
    this.name = props.name ?? `effectsGeometry:${geometryId++}`;
    this.drawStart = props.drawStart ?? 0;
    this.drawCount = props.drawCount ?? 0;
    this.mode = props.mode ?? 4;
    this.instanceCount = props.instanceCount ?? 0;
    this.bufferUsage = usage;
    this.options = props;
    if (props.indices) {
      const data = props.indices.data;

      if (!isIndexData(data)) {
        throw new TypeError('Index data must use a supported integer array.');
      }
      // 索引还会参与 CPU 侧的命中检测和几何查询，因此始终保留源数据。
      this.indices = Array.isArray(data)
        ? shouldUse32Bits(data) ? new Uint32Array(data) : new Uint16Array(data)
        : data;
    }
    this.disposeVertexArrayObjects();
  }

  private releaseCurrentBuffers (): void {
    const wasInitialized = this.initialized;

    this.disposeVertexArrayObjects();
    Object.keys(this.vertexBuffers).forEach(name => this.vertexBuffers[name].dispose());
    this.releaseIndexBuffer();
    this.vertexBuffers = {};
    this.indices = new Uint16Array(0);
    if (wasInitialized) {
      this.engine.removeGeometry(this);
      this.initialized = false;
    }
  }

  private disposeVertexArrayObjects (): void {
    if (this.vertexArrayObjects) {
      Object.keys(this.vertexArrayObjects).forEach(key => this.releaseVertexArrayObject(key));
    }
  }

  private createIndexBuffer (): void {
    const indices = this.indices;

    if (indices.length === 0 || this.indexBuffer) {
      return;
    }
    this.indexBuffer = this.engine.createIndexBuffer(indices, {
      usage: this.bufferUsage,
      type: this.getIndexType(),
      byteStride: 0,
      instanceDivisor: 0,
      label: `${this.name}##index`,
    });
  }

  private releaseIndexBuffer (): void {
    if (!this.indexBuffer) {
      return;
    }
    this.engine.releaseBuffer(this.indexBuffer);
    this.indexBuffer = undefined;
  }

  private forEachVertexBuffer (callback: (buffer: Buffer) => void): void {
    const visited = new Set<Buffer>();

    Object.keys(this.vertexBuffers).forEach(name => {
      const buffer = this.vertexBuffers[name].getWrapperBuffer();

      if (!visited.has(buffer)) {
        visited.add(buffer);
        callback(buffer);
      }
    });
  }
}

function isTypedArray (value: unknown): value is spec.TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function hasVertexArrayObjectMethods (engine: Engine): engine is Engine & VertexArrayObjectEngine {
  const candidate = engine as Engine & Partial<VertexArrayObjectEngine>;

  return typeof candidate.recordVertexArrayObject === 'function'
    && typeof candidate.bindVertexArrayObject === 'function'
    && typeof candidate.releaseVertexArrayObject === 'function';
}

function supportsVertexArrayObjects (engine: Engine): engine is Engine & VertexArrayObjectEngine {
  return engine.gpuCapability?.detail.vertexArrayObject === true
    && hasVertexArrayObjectMethods(engine);
}

function isIndexData (data: IndicesArray): boolean {
  return Array.isArray(data)
    || data instanceof Int32Array
    || data instanceof Uint16Array
    || data instanceof Uint32Array;
}

function shouldUse32Bits (data: IndicesArray): boolean {
  if (data instanceof Uint32Array) {
    return true;
  }
  if (data instanceof Uint16Array) {
    return false;
  }
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= 65535) {
      return true;
    }
  }

  return false;
}

function createAttributeFromChannel (
  channel: spec.VertexChannel,
  buffer: Uint8Array,
  vertexCount: number,
  size: number,
): spec.AttributeWithData {
  return {
    type: vertexFormatToDataType(channel.format),
    size,
    data: createVertexTypedArray(channel, buffer, vertexCount),
    normalize: channel.normalize,
  };
}

function createVertexTypedArray (
  channel: spec.VertexChannel,
  baseBuffer: Uint8Array,
  vertexCount: number,
): spec.TypedArray {
  const arrayBuffer = baseBuffer.buffer;
  const byteOffset = baseBuffer.byteOffset + channel.offset;
  const length = channel.dimension * vertexCount;

  switch (channel.format) {
    case spec.VertexFormatType.Float32:
      return new Float32Array(arrayBuffer, byteOffset, length);
    case spec.VertexFormatType.Int16:
      return new Int16Array(arrayBuffer, byteOffset, length);
    case spec.VertexFormatType.Int8:
      return new Int8Array(arrayBuffer, byteOffset, length);
    case spec.VertexFormatType.UInt16:
      return new Uint16Array(arrayBuffer, byteOffset, length);
    case spec.VertexFormatType.UInt8:
      return new Uint8Array(arrayBuffer, byteOffset, length);
    default:
      throw new Error(`Unsupported vertex format: ${channel.format}.`);
  }
}

function createIndexTypedArray (
  type: spec.IndexFormatType,
  baseBuffer: Uint8Array,
  offset: number,
): Uint16Array | Uint32Array {
  const arrayBuffer = baseBuffer.buffer;
  const byteOffset = baseBuffer.byteOffset + offset;
  const byteLength = baseBuffer.byteLength - offset;

  switch (type) {
    case spec.IndexFormatType.UInt16:
      return new Uint16Array(arrayBuffer, byteOffset, byteLength / Uint16Array.BYTES_PER_ELEMENT);
    case spec.IndexFormatType.UInt32:
      return new Uint32Array(arrayBuffer, byteOffset, byteLength / Uint32Array.BYTES_PER_ELEMENT);
    default:
      throw new Error(`Unsupported index format: ${type}.`);
  }
}

function vertexFormatToDataType (format: spec.VertexFormatType): spec.BufferType {
  switch (format) {
    case spec.VertexFormatType.Float32:
      return BufferDataType.Float;
    case spec.VertexFormatType.Int16:
      return BufferDataType.Short;
    case spec.VertexFormatType.Int8:
      return BufferDataType.Byte;
    case spec.VertexFormatType.UInt16:
      return BufferDataType.UnsignedShort;
    case spec.VertexFormatType.UInt8:
      return BufferDataType.UnsignedByte;
    default:
      throw new Error(`Unsupported vertex format: ${format}.`);
  }
}

function hasSemantic (data: spec.GeometryData): boolean {
  return data.vertexData.channels.some(channel => !!channel.semantic);
}

function decodeBase64ToArrayBuffer (value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

const vertexBufferSemanticMap: Record<string, string> = {
  POSITION: 'aPos',
  TEXCOORD0: 'aUV',
  TEXCOORD_0: 'aUV',
  TEXCOORD1: 'aUV2',
  NORMAL: 'aNormal',
  TANGENT: 'aTangent',
  COLOR: 'aColor',
  JOINTS: 'aJoints',
  JOINTS_0: 'aJoints',
  WEIGHTS: 'aWeights',
  WEIGHTS_0: 'aWeights',
  POSITION_BS0: 'aTargetPosition0',
  POSITION_BS1: 'aTargetPosition1',
  POSITION_BS2: 'aTargetPosition2',
  POSITION_BS3: 'aTargetPosition3',
  POSITION_BS4: 'aTargetPosition4',
  POSITION_BS5: 'aTargetPosition5',
  POSITION_BS6: 'aTargetPosition6',
  POSITION_BS7: 'aTargetPosition7',
  NORMAL_BS0: 'aTargetNormal0',
  NORMAL_BS1: 'aTargetNormal1',
  NORMAL_BS2: 'aTargetNormal2',
  NORMAL_BS3: 'aTargetNormal3',
  TANGENT_BS0: 'aTargetTangent0',
  TANGENT_BS1: 'aTargetTangent1',
  TANGENT_BS2: 'aTargetTangent2',
  TANGENT_BS3: 'aTargetTangent3',
};

export const BYTES_TYPE_MAP: Record<string, number> = {
  [BufferDataType.Float]: 4,
  [BufferDataType.Int]: 4,
  [BufferDataType.UnsignedInt]: 4,
  [BufferDataType.Short]: 2,
  [BufferDataType.UnsignedShort]: 2,
  [BufferDataType.Byte]: 1,
  [BufferDataType.UnsignedByte]: 1,
};

export function generateEmptyTypedArray (type: number): spec.TypedArray {
  return createTypedArray(type, 0);
}
