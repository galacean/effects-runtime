import type { Geometry, Mesh } from '../../../render';
import type { ParticleEmitter } from '../emitter/particle-emitter';

/**
 * 一个粒子渲染器的运行时实例。对齐 particle-system-pro 的 ProRenderer：
 * 每帧从 emitter 的 DataBuffer 读粒子状态生成顶点/索引数据。
 */
export abstract class ParticleRenderer {
  abstract readonly mesh: Mesh;
  abstract readonly geometry: Geometry;

  /**
   * 每帧从粒子数据生成渲染数据（顶点 / 索引等）。
   */
  abstract generateDynamicData (emitter: ParticleEmitter): void;

  /**
   * 清空当前渲染数据（drawCount=0），不释放底层资源。
   */
  abstract clear (): void;
}
