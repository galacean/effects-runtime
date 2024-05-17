import type { Engine, GeometryProps } from '@galacean/effects-core';
import { spec, assertExist, BYTES_TYPE_MAP, generateEmptyTypedArray, Geometry, glContext, vertexFormatType2GLType } from '@galacean/effects-core';
import type { GLEngine } from './gl-engine';
import type { GLGPUBufferProps } from './gl-gpu-buffer';
import { GLGPUBuffer } from './gl-gpu-buffer';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLVertexArrayObject } from './gl-vertex-array-object';

type BufferDirtyFlag = {
  dirty: boolean,
  discard?: boolean,
  start?: number,
  end?: number,
};

const INDEX_TYPE_MAP = {
  [Uint8Array.BYTES_PER_ELEMENT]: glContext.UNSIGNED_BYTE,
  [Uint16Array.BYTES_PER_ELEMENT]: glContext.UNSIGNED_SHORT,
  [Uint32Array.BYTES_PER_ELEMENT]: glContext.UNSIGNED_INT,
};

let seed = 1;

/**
 * 应用层 Geometry 对象，本身不直接保存 GPU 资源而是通过 geometryInternal 成员保存 GPU 资源
 */
export class GLGeometry extends Geometry {
  /**
   * 索引缓冲区
   */
  indicesBuffer?: GLGPUBuffer;
  drawCount = 0;
  drawStart: number;
  mode: number;
  /**
   * 记录顶点属性信息用于 GLProgram 绑定顶点属性
   */
  attributes: Record<string, spec.AttributeWithType>;
  /**
   * JS 端记录数据，用于 flush
   */
  bufferProps: Record<string, GLGPUBufferProps>;
  /**
   * 记录了顶点属性与 GPUBuffer 对应关系
   */
  buffers: Record<string, GLGPUBuffer> = {};
  indices?: spec.TypedArray;
  readonly vaos: Record<string, GLVertexArrayObject | undefined> = {};

  protected initialized = false;
  private options?: GeometryProps;
  private attributesReleasable: Record<string, boolean>;
  private indicesReleasable = false;
  // 记录 SubData 的变更范围
  private dirtyFlags: Record<string, BufferDirtyFlag>;
  private attributesName: string[] = [];
  private destroyed = false;

  // TODO: 参数必传的用 props，可选的用 options，如果 props里面还有 options，则 options 需要修改名字（如renderOptions）
  constructor (engine: Engine, props?: GeometryProps) {
    super(engine);
    if (props) {
      this.processProps(props);
    }
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  get isInitialized (): boolean {
    return this.initialized;
  }

  getOptions () {
    return { ...this.options };
  }

  /**
   * Geometry 的 GPU 资源初始化方法，在绘制前调用
   */
  override initialize (): void {
    if (this.initialized) {
      return;
    }

    const engine = this.engine;

    assertExist(engine);

    engine.addGeometry(this);
    const pipelineContext = (this.engine as GLEngine).getGLPipelineContext();

    // 创建vbo
    Object.keys(this.bufferProps).forEach(name => {
      this.buffers[name] = new GLGPUBuffer(pipelineContext, this.bufferProps[name]);
    });
    // 创建ibo
    if (this.indices) {
      this.indicesBuffer = this.createIndicesBuffer(pipelineContext, this.indices);
    }

    this.initialized = true;
    // 向 GPU 传输顶点数据
    this.flush();
    this.options = undefined;
  }

  getAttributeBuffer (name: string): GLGPUBuffer | undefined {
    if (!this.initialized) { return undefined; }
    const key = this.attributes[name].dataSource;

    return this.buffers[key];
  }

  setAttributeData (name: string, data: spec.TypedArray): void {
    if (this.bufferProps == undefined) { return; }

    const bufferOption = this.getAttributeBufferOption(name);
    const key = this.attributes[name].dataSource;

    if (bufferOption) {
      const { usage, target } = bufferOption;

      this.bufferProps[key] = {
        data,
        usage,
        target,
        elementCount: data.length,
      };
      this.dirtyFlags[key].discard = true;
      this.dirtyFlags[key].dirty = true;
    }
  }

  getAttributeData (name: string): spec.TypedArray | undefined {
    if (this.bufferProps == undefined) { return; }

    const bufferOption = this.getAttributeBufferOption(name);

    return bufferOption ? bufferOption.data : undefined;
  }

  setAttributeSubData (name: string, offset: number, data: spec.TypedArray): void {
    if (this.bufferProps == undefined) { return; }

    const attribute = this.getAttributeBufferOption(name);

    if (attribute && attribute.data != undefined) {
      const start = offset;
      const length = offset + data.length;

      if (attribute.data.length < length) {
        // @ts-expect-error safe to use
        const newData = new data.constructor(length);

        newData.set(attribute.data);
        attribute.data = newData;
        this.dirtyFlags[name].discard = true;
      } else if (!this.dirtyFlags[name].discard) {
        const dirtyFlag = this.dirtyFlags[name];

        dirtyFlag.start = Math.min(dirtyFlag.start!, start);
        dirtyFlag.end = Math.max(dirtyFlag.end!, length - 1);
      }
      (attribute.data as spec.TypedArray).set(data, start);
      this.dirtyFlags[name].dirty = true;
    }
  }

  getIndexData (): spec.TypedArray | undefined {
    return this.indices;
  }

  setIndexData (data: spec.TypedArray): void {
    if (
      data instanceof Uint8Array ||
      data instanceof Uint16Array ||
      data instanceof Uint32Array
    ) {
      this.indices = data as any;
      this.dirtyFlags['index'].discard = true;
      this.dirtyFlags['index'].dirty = true;
    }
  }

  setIndexSubData (offset: number, data: spec.TypedArray): void {
    if (this.indices) {
      const start = offset;
      const length = offset + data.length;

      if (this.indices.length < length) {
        // @ts-expect-error safe to use
        const newData = new data.constructor(length);

        newData.set(this.indices);
        this.indices = newData;
        this.dirtyFlags['index'].discard = true;
      } else if (!this.dirtyFlags['index'].discard) {
        const dirtyFlag = this.dirtyFlags['index'];

        dirtyFlag.start = Math.min(dirtyFlag.start!, start);
        dirtyFlag.end = Math.max(dirtyFlag.end!, length - 1);
      }
      this.indices?.set(data, start);
      this.dirtyFlags['index'].dirty = true;
    }
  }

  getAttributeStride (name: string): number {
    const attr = this.attributes[name];
    const { stride, size, type } = attr;

    return stride ? stride : size * BYTES_TYPE_MAP[type];
  }

  getAttributeNames (): string[] {
    return this.attributesName;
  }

  setDrawStart (count: number): void {
    this.drawStart = count;
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

  // 根据 attribute 的 datasource 获取 js 端 buffer
  private getAttributeBufferOption (name: string): GLGPUBufferProps | undefined {
    const attribute = this.attributes[name];

    return attribute ? this.bufferProps[attribute.dataSource] : undefined;
  }

  createIndicesBuffer (pipelineContext: GLPipelineContext, data: spec.TypedArray): GLGPUBuffer {
    const type = INDEX_TYPE_MAP[data.BYTES_PER_ELEMENT];
    const indexProps = {
      data,
      target: glContext.ELEMENT_ARRAY_BUFFER,
      type,
      name: `${this.name}##index`,
    };

    return new GLGPUBuffer(pipelineContext, indexProps);
  }

  override flush () {
    if (!this.initialized) { return; }

    const attributes = this.attributes;
    const bufferProps = this.bufferProps;
    const indices = this.indices;

    Object.keys(this.dirtyFlags).forEach(name => {
      const flag = this.dirtyFlags[name];
      let buffer;
      let data;

      if (name == 'index') {
        buffer = this.indicesBuffer;
        data = indices;
      } else {
        const bufferName = attributes[name].dataSource;

        buffer = this.buffers[bufferName];
        data = bufferProps[bufferName].data;
      }

      if ((flag.dirty || flag.discard) && buffer && data) {
        if (flag.discard) {
          buffer.bufferData(data);
        } else {
          const offset = flag.start! * data.BYTES_PER_ELEMENT + data.byteOffset;
          const length = flag.end! - flag.start! + 1;
          // @ts-expect-error safe to use
          const subData = new data.constructor(data.buffer, offset, length);

          buffer.bufferSubData(flag.start!, subData);
        }
        flag.start = Number.POSITIVE_INFINITY;
        flag.end = 0;
        flag.dirty = flag.discard = false;
      }
    });

    // 需要释放的 attributes 数据
    Object.keys(this.attributesReleasable).forEach(name => {
      const releasable = this.attributesReleasable[name];
      const bufferName = attributes[name].dataSource;

      if (bufferProps[bufferName] && releasable) {
        bufferProps[bufferName].data = undefined;
      }
    });

    // 释放 indices buffer
    if (this.indicesReleasable) {
      //this.indices = undefined;
    }
  }

  private processProps (data: GeometryProps): void {
    const props = data;
    const {
      drawStart = 0, drawCount, mode, indices,
      name = `effectsGeometry:${seed++}`,
      bufferUsage = glContext.STATIC_DRAW,
    } = props;

    this.name = name;

    // 记录顶点属性，需要与 Shader 中 attribute 进行关联
    const bufferProps: Record<string, GLGPUBufferProps> = {};
    const attributesName: string[] = [];
    const attributes: Record<string, spec.AttributeWithType> = {};
    // key为buffer的名字
    const dirtyFlags: Record<string, BufferDirtyFlag> = {};
    const attributesReleasable: Record<string, boolean> = {};
    const usage = bufferUsage;

    this.drawStart = drawStart;
    if (drawCount !== undefined) {
      this.drawCount = drawCount;
    }
    this.mode = (isNaN(mode as number) ? glContext.TRIANGLES : mode) as number;

    Object.keys(props.attributes).forEach(name => {
      const attr = props.attributes[name];
      const { size, stride, offset, normalize } = attr;
      const { type = glContext.FLOAT, releasable } = attr as spec.AttributeWithData;
      let { data } = attr as spec.AttributeWithData;

      if (type && !('dataSource' in attr) && !data) {
        data = generateEmptyTypedArray(type);
      }
      if (data) {
        const glType = data instanceof Float32Array ? glContext.FLOAT : glContext.INT;

        // 使用 AttributeWithData 构造的 attribute
        bufferProps[name] = {
          data, usage, target: glContext.ARRAY_BUFFER, name,
        };
        attributes[name] = {
          size,
          stride,
          offset,
          type: type ?? glType,
          normalize: !!normalize,
          dataSource: name,
        };
        attributesReleasable[name] = releasable ?? false;
        dirtyFlags[name] = {
          dirty: true,
          discard: true,
          start: Number.POSITIVE_INFINITY,
          end: 0,
        };
      } else {
        // 使用 AttributeWithType 构造的 attribute
        const { dataSource } = attr as spec.AttributeWithType;

        if (dataSource) {
          // 属性共享 buffer
          attributes[name] = {
            size,
            stride,
            offset,
            type,
            dataSource,
            normalize: !!normalize,
          };
        }
      }
      attributesName.push(name);
    });

    dirtyFlags.index = {
      dirty: true,
      discard: true,
      start: Number.POSITIVE_INFINITY,
      end: 0,
    };
    // 顶点索引
    this.indices = indices?.data;
    this.indicesReleasable = indices?.releasable === true;
    this.bufferProps = bufferProps;
    this.attributes = attributes;
    this.attributesName = attributesName;
    this.attributesReleasable = attributesReleasable;
    this.dirtyFlags = dirtyFlags;
    this.options = props;
    this.initialized = false;
  }

  override fromData (data: spec.GeometryData): void {
    super.fromData(data);

    this.subMeshes = data.subMeshes;
    const buffer = decodeBase64ToArrays(data.buffer);
    const vertexCount = data.vertexData.vertexCount;

    if (this.hasSemantic(data)) {
      const geometryProps: GeometryProps = {
        mode: glContext.TRIANGLES,
        attributes: {},
      };

      data.vertexData.channels.forEach(channel => {
        const attribName = vertexBufferSemanticMap[channel.semantic] ?? channel.semantic;
        const attribBuffer = this.createVertexTypedArray(channel, buffer, vertexCount);

        geometryProps.attributes[attribName] = {
          type: vertexFormatType2GLType(channel.format),
          size: channel.dimension,
          data: attribBuffer,
          normalize: channel.normalize,
        };
      });

      if (data.indexOffset >= 0) {
        const indexBuffer = this.createIndexTypedArray(data.indexFormat, buffer, data.indexOffset);

        geometryProps.indices = { data: indexBuffer };
        geometryProps.drawCount = indexBuffer.length;
      } else {
        geometryProps.drawCount = vertexCount;
      }

      this.processProps(geometryProps);
    } else {
      const positionChannel = data.vertexData.channels[0];
      const uvChannel = data.vertexData.channels[1];
      const normalChannel = data.vertexData.channels[2];

      // 根据提供的长度信息创建 Float32Array
      const positionBuffer = this.createVertexTypedArray(positionChannel, buffer, vertexCount);
      const uvBuffer = this.createVertexTypedArray(uvChannel, buffer, vertexCount);
      const normalBuffer = this.createVertexTypedArray(normalChannel, buffer, vertexCount);
      // 根据提供的长度信息创建 Uint16Array，它紧随 Float32Array 数据之后
      const indexBuffer = this.createIndexTypedArray(data.indexFormat, buffer, data.indexOffset);

      const geometryProps: GeometryProps = {
        mode: glContext.TRIANGLES,
        attributes: {
          aPos: {
            type: vertexFormatType2GLType(positionChannel.format),
            size: 3,
            data: positionBuffer,
            normalize: positionChannel.normalize,
          },
          aUV: {
            type: vertexFormatType2GLType(uvChannel.format),
            size: 2,
            data: uvBuffer,
            normalize: uvChannel.normalize,
          },
          aNormal: {
            type: vertexFormatType2GLType(normalChannel.format),
            size: 3,
            data: normalBuffer,
            normalize: normalChannel.normalize,
          },
        },
      };

      geometryProps.indices = { data: indexBuffer };
      geometryProps.drawCount = indexBuffer.length;
      this.processProps(geometryProps);
    }
  }

  override dispose (): void {
    this.drawStart = 0;
    this.drawCount = NaN;
    this.bufferProps = {};
    this.indices = undefined;
    this.attributes = {};
    this.attributesName = [];
    this.options = undefined;

    if (this.initialized) {
      Object.keys(this.buffers).forEach(name => {
        this.buffers[name].dispose();
      });
      this.buffers = {};
      this.indicesBuffer?.dispose();
      Object.keys(this.vaos).forEach(name => {
        this.vaos[name]?.dispose();
        this.vaos[name] = undefined;
      });
      this.indicesBuffer = undefined;

      if (this.engine !== undefined) {
        this.engine.removeGeometry(this);
        // @ts-expect-error
        this.engine = undefined;
      }
    }
    this.destroyed = true;
  }

  private createVertexTypedArray (channel: spec.VertexChannel, baseBuffer: ArrayBufferLike, vertexCount: number) {
    switch (channel.format) {
      case spec.VertexFormatType.Float32:
        return new Float32Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
      case spec.VertexFormatType.Int16:
        return new Int16Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
      case spec.VertexFormatType.Int8:
        return new Int8Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
      case spec.VertexFormatType.UInt16:
        return new Uint16Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
      case spec.VertexFormatType.UInt8:
        return new Uint8Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
      default:
        console.error(`Invalid vertex format type: ${channel.format}`);

        return new Float32Array(baseBuffer, channel.offset, channel.dimension * vertexCount);
    }
  }

  private createIndexTypedArray (type: spec.IndexFormatType, baseBuffer: ArrayBufferLike, offset: number) {
    switch (type) {
      case spec.IndexFormatType.UInt16:
        return new Uint16Array(baseBuffer, offset);
      case spec.IndexFormatType.UInt32:
        return new Uint32Array(baseBuffer, offset);
      default:
        console.error(`Invalid index format type: ${type}`);

        return new Uint32Array(baseBuffer, offset);
    }
  }

  private hasSemantic (data: spec.GeometryData) {
    let hasSemantic = false;
    const { vertexData } = data;

    vertexData.channels.forEach(channel => {
      if (channel.semantic && channel.semantic.length > 0) {
        hasSemantic = true;
      }
    });

    return hasSemantic;
  }

}

const vertexBufferSemanticMap: Record<string, string> = {
  POSITION: 'aPos',
  TEXCOORD0: 'aUV',
  TEXCOORD1: 'aUV2',
  NORMAL: 'aNormal',
  TANGENT: 'aTangent',
  COLOR: 'aColor',
  JOINTS: 'aJoints',
  WEIGHTS: 'aWeights',
  //
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

function decodeBase64ToArrays (base64String: string) {
  // 将 Base64 编码的字符串转换为二进制字符串
  const binaryString = atob(base64String);

  // 将二进制字符串转换为字节数组
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 创建 ArrayBuffer 并为其创建视图
  const buffer = bytes.buffer;

  // 返回解码后的数组
  return buffer;
}