import type { ProEmitterInstance } from '../simulation/emitter-instance';
import type { ProRendererProperties } from './renderer-properties';

/**
 * 一个粒子渲染器的运行时实例。
 *
 * 由 properties 描述驱动，每帧从 emitter 的 DataSet 读取粒子状态生成
 * 顶点 / 实例数据。Phase 1 只提供基类与生命周期约定，Sprite/Mesh/Ribbon
 * 具体实现在后续 Phase 加入。
 */
export abstract class ProRenderer {
  readonly properties: ProRendererProperties;

  constructor (properties: ProRendererProperties) {
    this.properties = properties;
  }

  /**
   * 在 emitter 已经准备好 DataSet 后调用一次，用来分配 GPU / Mesh 资源。
   */
  abstract initialize (emitterInstance: ProEmitterInstance): void;

  /**
   * 每帧从粒子数据生成渲染数据（顶点 / 实例属性 / 排序索引等）。
   * 返回值类型由具体子类决定。
   */
  abstract generateDynamicData (emitterInstance: ProEmitterInstance): unknown;

  /**
   * 释放底层 GPU / CPU 资源。emitter 销毁时调用。
   */
  abstract release (): void;
}
