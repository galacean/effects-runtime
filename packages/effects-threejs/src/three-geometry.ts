import type { Attribute, Engine, GeometryProps, spec } from '@galacean/effects-core';
import { BYTES_TYPE_MAP, generateEmptyTypedArray, Geometry, glContext } from '@galacean/effects-core';
import * as THREE from 'three';
import { ThreeComposition } from './three-composition';

let seed = 1;

/**
 * THREE 中 attribute info 接口
 */
interface ThreeAttributeWithType {
  /**
   * THREE 中 attribute 对象
   */
  attribute: THREE.InterleavedBufferAttribute,
  /**
   * attribute 类型
   */
  type: number,
  /**
   * 共享或单独的 buffer
   */
  buffer: THREE.InterleavedBuffer,
  /**
   * 数据长度
   */
  dataLength: number,
}

/**
 * THREE 中的 geometry 的抽象实现类
 */
export class ThreeGeometry extends Geometry {
  /**
   * geometry 对象
   */
  geometry: THREE.BufferGeometry;
  /**
   * 记录顶点属性信息用于缓存
   */
  attributes: Record<string, ThreeAttributeWithType> = {};
  /**
   * geometry 绘制模式
   */
  public readonly mode: GLenum;

  private destroyed = false;
  private attributesName: string[] = [];

  /**
   * 构造函数
   * @param props - geometry 创建参数
   */
  constructor (engine: Engine, props: GeometryProps) {
    const {
      drawStart = 0, drawCount, indices, mode,
      name = `effectsGeometry:${seed++}`,
    } = props;

    super(name);
    this.mode = mode ?? glContext.TRIANGLES;
    const attributesName: string[] = [];
    const attributes: Record<string, ThreeAttributeWithType> = {};
    const geometry = new THREE.BufferGeometry();

    Object.keys(props.attributes).forEach(name => {
      const attr = props.attributes[name];

      if (!('dataSource' in attr)) {
        this.setAttributeType(name, attr, geometry, attributes, props.maxVertex);
      } else {
        // 使用AttributeWithType构造的attribute
        const { dataSource } = attr as spec.AttributeWithType;

        if (dataSource) {
          if (attributes[dataSource] === undefined) {
            this.setAttributeType(dataSource, attr, geometry, attributes, props.maxVertex);
          }
          const { size, offset, normalize } = attr;
          const dataSourceAttribute = attributes[dataSource];
          const buffer = dataSourceAttribute.buffer;
          const dataLength = dataSourceAttribute.dataLength;
          const attribute = new THREE.InterleavedBufferAttribute(buffer, size, (offset ?? 0) / dataLength, normalize);

          geometry.setAttribute(name, attribute);
          attributes[name] = {
            buffer,
            attribute,
            type: dataSourceAttribute.type,
            dataLength,
          };
        }
      }

      attributesName.push(name);

    });

    if (indices && indices.data) {
      geometry.setIndex(new THREE.BufferAttribute(indices.data, 1));
    }

    this.geometry = geometry;
    this.attributes = attributes;
    this.attributesName = attributesName;
    this.drawStart = drawStart;
    this.drawCount = drawCount ?? 0;
  }

  /**
   * 获取绘制数量
   */
  get drawCount (): number {
    return this.geometry.drawRange.count;
  }

  /**
   * 设置绘制数量
   */
  set drawCount (val: number) {
    this.geometry.drawRange.count = val;
  }

  /**
   * 获取绘制起点
   */
  get drawStart (): number {
    return this.geometry.drawRange.start;
  }

  /**
   * 设置绘制起点
   */
  set drawStart (val: number) {
    this.geometry.drawRange.start = val;
  }

  /**
   * 获取 attribute 数据
   *
   * @param name - attribute 名称
   * @returns 返回 attribute 数据，如果为空返回 undefined
   */
  getAttributeData (name: string): spec.TypedArray | undefined {
    if (this.attributes[name] == undefined) {
      return;
    }

    return this.attributes[name].buffer.array as spec.TypedArray;
  }

  /**
   * 设置 attribute 数据
   *
   * @param name - attribute 名称
   * @param data - attribute 数据
   * @returns
   */
  setAttributeData (name: string, data: spec.TypedArray): void {
    if (this.attributes[name] == undefined) {
      return;
    }

    const attributeBuffer = this.attributes[name].buffer;

    attributeBuffer.updateRange.count = data.length;
    attributeBuffer.updateRange.offset = 0;
    attributeBuffer.set(data, 0);
    this.geometry.attributes[name].needsUpdate = true;
  }

  /**
   * 设置可变的 attribute 数据
   *
   * @param name - attribute 名称
   * @param dataOffset - 数据偏移
   * @param data - 数据内容
   * @returns
   */
  setAttributeSubData (name: string, dataOffset: number, data: spec.TypedArray): void {
    if (this.attributes[name] == undefined) {
      return;
    }

    const attributeBuffer = this.attributes[name].buffer;

    attributeBuffer.set(data, dataOffset);
    this.geometry.attributes[name].needsUpdate = true;
  }

  /**
   * 获取 attribute 数据步长
   *
   * @param name - attribute名称
   * @returns 返回步长值
   */
  getAttributeStride (name: string): number {
    const attribute = this.attributes[name];

    return attribute.buffer.stride * BYTES_TYPE_MAP[attribute.type];
  }

  /**
   * 获取用到的所有 attribute 名称
   * @returns 返回名称数组
   */
  getAttributeNames (): string[] {
    return this.attributesName;
  }

  /**
   * 获取 index attribute 数据
   * @returns 返回数据，如果为空返回 undefined
   */
  getIndexData (): spec.TypedArray | undefined {
    const index = this.geometry.getIndex();

    return index === null ? undefined : index.array as spec.TypedArray;
  }

  /**
   * 设置 index attribute 数据
   *
   * @param data - index 数据
   */
  setIndexData (data?: spec.TypedArray): void {
    if (data) {
      this.geometry.setIndex(new THREE.BufferAttribute(data, 1));
      this.geometry.index!.needsUpdate = true;
    }
  }

  /**
   * 设置偏移 index 数据
   *
   * @param offset - 数据偏移量
   * @param data - 数据内容
   */
  setIndexSubData (offset: number, data: spec.TypedArray): void {
    const index = this.geometry.getIndex();

    if (index !== null) {

      const start = offset;
      const length = offset + data.length;
      const array = index.count;

      if (array < length) {
        // @ts-expect-error safe to use
        const newData = new data.constructor(end);

        newData.set(index.array);
        index.array = newData;
      }
      //@ts-expect-error
      index.array.set(data, start);
      this.geometry.index!.needsUpdate = true;

    }
  }

  /**
   * 设置绘制偏移
   *
   * @param start - 绘制偏移
   */
  setDrawStart (start: number): void {
    this.drawStart = start;
  }

  /**
   * 获取绘制偏移
   *
   * @returns 返回绘制移
   */
  getDrawStart (): number {
    return this.drawStart;
  }

  /**
   * 设置绘制数量
   *
   * @param count - 绘制数量
   */
  setDrawCount (count: number): void {
    this.drawCount = count;
  }

  /**
   * 获取绘制数量
   *
   * @returns 返回绘制数量
   */
  getDrawCount (): number {
    return this.drawCount;
  }

  /**
   * 销毁方法
   *
   * @returns
   */
  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.geometry.dispose();
    this.destroyed = true;
  }

  private setAttributeType (
    name: string,
    attr: Attribute,
    geometry: THREE.BufferGeometry,
    attributes: Record<string, ThreeAttributeWithType>,
    maxCount?: number,
  ) {
    const { size, offset, normalize, type = glContext.FLOAT } = attr as spec.AttributeWithData;
    let { stride, data } = attr as spec.AttributeWithData;

    if (type && !data) {
      data = generateEmptyTypedArray(type);
    }

    if (!data) {
      return;
    }
    if (name === 'aSprite') {
      stride = 12;
    } else {
      stride = stride ?? 0;
    }
    const dataLength = data instanceof Float32Array ? Float32Array.BYTES_PER_ELEMENT : Uint16Array.BYTES_PER_ELEMENT;
    const threeStride = stride / dataLength;

    if (maxCount) {

      const length = maxCount * stride + (ThreeComposition.shape[name] ?? 0);

      // 如果传入了data且data.length不为0 使用传入的data 否则根据length新建数组
      if (data.length === 0) {
        data = data instanceof Float32Array ? new Float32Array(length) : new Uint16Array(length);
      }

    }
    const buffer = new THREE.InterleavedBuffer(data, threeStride);
    const attribute = new THREE.InterleavedBufferAttribute(buffer, size, (offset ?? 0) / dataLength, normalize);

    geometry.setAttribute(name, attribute);
    attributes[name] = {
      buffer,
      attribute,
      type,
      dataLength,
    };
  }
}
