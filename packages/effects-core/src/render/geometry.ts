import * as spec from '@galacean/effects-specification';
import type { Engine } from '../engine';
import { EffectsObject } from '../effects-object';
import type { Disposable } from '../utils';
import { Buffer } from './buffer';
import {
  BufferDataType, BufferUsage, createTypedArray, getBytesPerElement, getDataType,
} from './data-buffer';
import { VertexBuffer } from './vertex-buffer';

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
  indices?: { data: spec.TypedArray, releasable?: boolean },
  mode?: GeometryDrawMode,
  drawCount?: number,
  drawStart?: number,
  instanceCount?: number,
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

/**
 * 几何数据、属性布局和绘制范围的后端无关实现。
 */
export class Geometry extends EffectsObject {
  static create = (engine: Engine, props?: GeometryProps): Geometry => new Geometry(engine, props);

  name = '';
  subMeshes: spec.SubMesh[] = [];
  /** @hide */
  attributes: Record<string, VertexBuffer> = {};
  /** @hide */
  drawCount = 0;
  /** @hide */
  drawStart = 0;
  /** @hide */
  mode: GeometryDrawMode = 4;
  /** @hide */
  instanceCount = 0;
  /** @hide */
  skin: SkinProps = {};

  private indexBuffer?: Buffer;
  private attributesName: string[] = [];
  private initialized = false;
  private destroyed = false;
  private options?: GeometryProps;
  private bufferUsage = BufferUsage.Static;
  private layoutVersion = 0;
  private readonly _vertexArrayObjects: Record<string, Disposable> = {};

  /** @hide */
  constructor (engine: Engine, props?: GeometryProps) {
    super(engine);
    if (props) {
      this.processProps(props);
    }
  }

  /** @hide */
  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /** @hide */
  get isInitialized (): boolean {
    return this.initialized;
  }

  /** @hide */
  get version (): number {
    return this.layoutVersion;
  }

  /** @hide */
  getOptions (): GeometryProps | undefined {
    return this.options ? { ...this.options } : undefined;
  }

  /** @hide */
  getVertexBuffer (name: string): VertexBuffer | undefined {
    return this.attributes[name];
  }

  /** @hide */
  getVertexBuffers (): Readonly<Record<string, VertexBuffer>> {
    return this.attributes;
  }

  /** @hide */
  setVertexBuffer (name: string, vertexBuffer: VertexBuffer): void {
    this.attributes[name]?.dispose();
    this.attributes[name] = vertexBuffer.createReference(name);
    if (!this.attributesName.includes(name)) {
      this.attributesName.push(name);
    }
    this.invalidateLayout();
  }

  /** @hide */
  getAttributeBuffer (name: string): Buffer | undefined {
    return this.attributes[name]?.buffer;
  }

  getAttributeData (name: string): spec.TypedArray | undefined {
    return this.attributes[name]?.getData();
  }

  setAttributeData (name: string, data: spec.TypedArray): void {
    this.attributes[name]?.buffer.setData(data);
  }

  setAttributeSubData (name: string, offset: number, data: spec.TypedArray): void {
    const vertexBuffer = this.attributes[name];

    if (!vertexBuffer) {
      return;
    }
    vertexBuffer.buffer.setSubData(offset, data);
  }

  getAttributeStride (name: string): number {
    return this.attributes[name]?.byteStride ?? 0;
  }

  getAttributeNames (): string[] {
    return this.attributesName.slice();
  }

  /** @hide */
  getIndexBuffer (): Buffer | undefined {
    return this.indexBuffer;
  }

  getIndexData (): spec.TypedArray | undefined {
    return this.indexBuffer?.getData();
  }

  /** @hide */
  getIndexType (): number {
    const data = this.getIndexData();

    return data ? getDataType(data) : this.indexBuffer?.type ?? BufferDataType.UnsignedShort;
  }

  setIndexData (data: spec.TypedArray): void {
    if (!isIndexData(data)) {
      throw new TypeError('Index data must use an unsigned integer typed array.');
    }
    const type: number = getDataType(data);

    if (!this.indexBuffer || this.indexBuffer.type !== type) {
      this.indexBuffer?.release();
      this.indexBuffer = new Buffer(this.engine, {
        data,
        kind: 'index',
        usage: this.bufferUsage,
        type,
        name: `${this.name}##index`,
      }).retain();
      this.invalidateLayout();
      if (this.initialized) {
        this.indexBuffer.initialize();
      }
    } else {
      this.indexBuffer.setData(data);
    }
  }

  setIndexSubData (offset: number, data: spec.TypedArray): void {
    if (!this.indexBuffer) {
      return;
    }
    this.indexBuffer.setSubData(offset, data);
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
  getVertexArrayObject<T extends Disposable> (key: string): T | undefined {
    return this._vertexArrayObjects[key] as T | undefined;
  }

  /** @hide */
  setVertexArrayObject<T extends Disposable> (key: string, vertexArrayObject: T): T {
    this.releaseVertexArrayObject(key);
    this._vertexArrayObjects[key] = vertexArrayObject;

    return vertexArrayObject;
  }

  /** @hide */
  releaseVertexArrayObject (key: string): void {
    this._vertexArrayObjects[key]?.dispose();
    delete this._vertexArrayObjects[key];
  }

  initialize (): void {
    if (this.initialized || this.destroyed) {
      return;
    }
    this.forEachBuffer(buffer => {
      buffer.initialize();
      buffer.flush();
    });
    this.engine.addGeometry(this);
    this.initialized = true;
    this.options = undefined;
  }

  flush (): void {
    if (this.destroyed) {
      return;
    }
    this.initialize();
    this.forEachBuffer(buffer => buffer.flush());
  }

  /** @hide */
  restore (): void {
    if (!this.initialized || this.destroyed) {
      return;
    }
    this.disposeVertexArrayObjects();
    this.forEachBuffer(buffer => buffer.restore());
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
    if (this.destroyed) {
      return;
    }
    this.disposeVertexArrayObjects();
    Object.keys(this.attributes).forEach(name => this.attributes[name].dispose());
    this.indexBuffer?.release();
    this.attributes = {};
    this.attributesName = [];
    this.indexBuffer = undefined;
    this.options = undefined;
    this.drawStart = 0;
    this.drawCount = NaN;
    if (this.initialized) {
      this.engine.removeGeometry(this);
    }
    this.initialized = false;
    this.destroyed = true;
    super.dispose();
  }

  private processProps (props: GeometryProps): void {
    this.releaseCurrentBuffers();
    const usage = props.bufferUsage ?? BufferUsage.Static;
    const sourceBuffers: Record<string, Buffer> = {};
    const sourceDivisors: Record<string, number> = {};

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
      sourceBuffers[name] = new Buffer(this.engine, {
        data,
        kind: 'vertex',
        usage,
        type,
        byteStride,
        instanceDivisor: sourceDivisors[name] ?? 0,
        releasable: attribute.releasable,
        name,
      });
    });
    Object.keys(props.attributes).forEach(name => {
      const attribute = props.attributes[name];
      const source = 'dataSource' in attribute ? attribute.dataSource : name;
      const buffer = sourceBuffers[source];

      if (!buffer) {
        throw new Error(`Attribute '${name}' references missing data source '${source}'.`);
      }
      const type = attribute.type ?? buffer.type;

      this.attributes[name] = new VertexBuffer(name, buffer, {
        size: attribute.size,
        type,
        dataSource: source,
        byteStride: attribute.stride || buffer.byteStride,
        byteOffset: attribute.offset ?? 0,
        normalized: attribute.normalize ?? false,
        instanceDivisor: attribute.instanceDivisor ?? 0,
      });
    });
    this.attributesName = Object.keys(props.attributes);
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
        throw new TypeError('Index data must use an unsigned integer typed array.');
      }
      // 索引还会参与 CPU 侧的命中检测和几何查询，因此始终保留源数据。
      this.indexBuffer = new Buffer(this.engine, {
        data,
        kind: 'index',
        usage,
        type: getDataType(data),
        name: `${this.name}##index`,
      }).retain();
    }
    this.invalidateLayout();
  }

  private releaseCurrentBuffers (): void {
    const wasInitialized = this.initialized;

    this.disposeVertexArrayObjects();
    Object.keys(this.attributes).forEach(name => this.attributes[name].dispose());
    this.indexBuffer?.release();
    this.attributes = {};
    this.attributesName = [];
    this.indexBuffer = undefined;
    if (wasInitialized) {
      this.engine.removeGeometry(this);
      this.initialized = false;
    }
  }

  private invalidateLayout (): void {
    this.layoutVersion++;
    this.disposeVertexArrayObjects();
  }

  private disposeVertexArrayObjects (): void {
    Object.keys(this._vertexArrayObjects).forEach(key => this.releaseVertexArrayObject(key));
  }

  private forEachBuffer (callback: (buffer: Buffer) => void): void {
    const visited = new Set<Buffer>();

    Object.keys(this.attributes).forEach(name => {
      const buffer = this.attributes[name].buffer;

      if (!visited.has(buffer)) {
        visited.add(buffer);
        callback(buffer);
      }
    });
    if (this.indexBuffer && !visited.has(this.indexBuffer)) {
      callback(this.indexBuffer);
    }
  }
}

function isTypedArray (value: unknown): value is spec.TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function isIndexData (data: spec.TypedArray): data is Uint8Array | Uint16Array | Uint32Array {
  return data instanceof Uint8Array || data instanceof Uint16Array || data instanceof Uint32Array;
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
