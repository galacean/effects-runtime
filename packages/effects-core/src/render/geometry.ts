import type * as spec from '@galacean/effects-specification';
import { glContext } from '../gl';
import type { Disposable } from '../utils';
import type { Engine } from '../engine';

export const BYTES_TYPE_MAP: Record<string, number> = {
  [glContext.FLOAT]: Float32Array.BYTES_PER_ELEMENT,
  [glContext.INT]: Int32Array.BYTES_PER_ELEMENT,
  [glContext.SHORT]: Int16Array.BYTES_PER_ELEMENT,
  [glContext.BYTE]: Int8Array.BYTES_PER_ELEMENT,
};

/**
 * Geometry 的绘制模式
 */
export type GeometryDrawMode =
  | WebGLRenderingContext['POINTS']
  | WebGLRenderingContext['TRIANGLES']
  | WebGLRenderingContext['TRIANGLE_STRIP']
  | WebGLRenderingContext['TRIANGLE_FAN']
  | WebGLRenderingContext['LINES']
  | WebGLRenderingContext['LINE_STRIP']
  | WebGLRenderingContext['LINE_LOOP']
  ;

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
  bufferUsage?: WebGLRenderingContext['STATIC_DRAW'] | WebGLRenderingContext['DYNAMIC_DRAW'],
  /**
   * 粒子最大数量，适用于无法更新 GPU 缓存长度的引擎接入
   */
  maxVertex?: number,
}

/**
 * Geometry 抽象类
 */
export abstract class Geometry implements Disposable {
  /**
   * Geometry 的名称
   */
  readonly name: string;

  /**
   * Geometry 创建函数
   * @param name - 名称
   */
  constructor (name: string) {
    this.name = name;
  }

  /**
   * Geometry 创建函数
   */
  static create: (engine: Engine, opts: GeometryProps) => Geometry;

  /**
   * 获取 Geometry 的 attribute 数据。
   * @param name - attribute 名称
   */
  abstract getAttributeData (name: string): spec.TypedArray | undefined;

  /**
   * 设置 Geometry 的 attribute 数据。
   * @param name - attribute 名称
   * @param data - 要设置的 attribute 数据
   */
  abstract setAttributeData (name: string, data: spec.TypedArray): void;

  /**
   * 设置 attribute 的部分数据，当 attribute 数据只有部分更新时，可调用此函数。
   * @param name - attribute 名称
   * @param offset - 更新数据在 attribute 数组的起始位置 index
   * @param data - 要设置的 attribute 数据
   */
  abstract setAttributeSubData (name: string, offset: number, data: spec.TypedArray): void;

  /**
   * 获取 attribute 的步长
   * @param name - attribute 名称
   */
  abstract getAttributeStride (name: string): number;

  /**
   * 获取当前 Geometry 所有的 attribute 名称。
   */
  abstract getAttributeNames (): string[];

  /**
   * 获取当前 Geometry 的 indices 数据。
   */
  abstract getIndexData (): spec.TypedArray | undefined;

  /**
   * 设置 Geometry 的 indices 数据。
   * @param data - 要设置的 indices 数据
   */
  abstract setIndexData (data?: spec.TypedArray): void;

  /**
   * 设置 indices 的部分数据，当 indices 数据只有部分更新时，可调用此函数。
   * @param offset - 更新数据在 indices 数组的起始位置 index
   * @param data - 要设置的 indices 数据
   */
  abstract setIndexSubData (offset: number, data: spec.TypedArray): void;

  /**
   * 设置 Geometry 绘制的 drawStart
   * @param value 要设置的 drawStart 值
   */
  abstract setDrawStart (count: number): void;

  /**
   * 获取当前 Geometry 的 drawStart
   */
  abstract getDrawStart (): number;

  /**
   * 设置 Geometry 绘制的 drawCount。
   * @param count 要设置的 drawCount 值
   */
  abstract setDrawCount (count: number): void;

  /**
   * 获取当前 Geometry 的 drawcount
   */
  abstract getDrawCount (): number;

  /**
   * 销毁当前资源
   */
  abstract dispose (): void;

  /**
   * 初始化 GPU 资源
   * @override
   */
  initialize (): void {
    // OVERRIDE
  }

  /**
   * 几何数据刷新
   */
  flush (): void {
    // OVERRIDE
  }
}

export function generateEmptyTypedArray (type: number) {
  if (type === glContext.INT) {
    return new Int32Array(0);
  }
  if (type === glContext.SHORT) {
    return new Int16Array(0);
  }

  return new Float32Array(0);
}
