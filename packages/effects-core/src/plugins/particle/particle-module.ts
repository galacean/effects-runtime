import type { ParticleDataBuffer } from './particle-data-buffer';

/**
 * 粒子模块执行阶段。对齐 particle-system-pro 的 4-stage 管线。
 *
 * - emitterSpawn:   发射器首次启动时执行一次
 * - emitterUpdate:  每帧执行，计算本帧发射数量
 * - particleSpawn:  新粒子出生时执行，写入初始属性
 * - particleUpdate: 每帧对所有存活粒子执行，积分推进状态
 */
type ParticleModuleStage =
  | 'emitterSpawn'
  | 'emitterUpdate'
  | 'particleSpawn'
  | 'particleUpdate';

/**
 * 模块执行上下文。各阶段共用同一类型，部分字段仅在特定阶段有意义。
 */
type ParticleModuleContext = {
  /** 本帧时间步长（秒） */
  deltaTime: number,
  /** 发射器当前本地时间（秒） */
  currentTime: number,
  /** 发射器归一化生命周期 [0, 1] */
  emitterLifetime: number,
  /** 发射器总时长（秒） */
  duration: number,
  /** SoA 数据缓冲区 */
  dataBuffer: ParticleDataBuffer,
  /** 处理范围起始索引（含）。particleSpawn: 新粒子范围；particleUpdate: 所有存活粒子 */
  firstIndex: number,
  /** 处理范围结束索引（不含） */
  lastIndex: number,
};

/**
 * 粒子模块基类。
 *
 * 参考 particle-system-pro 的 ProModule，简化为：
 * - 无 declareVariables（标准粒子系统使用固定通道布局）
 * - 无序列化（模块在 fromData 时由解析结果构建）
 *
 * 单 module 只属于一个 stage，execute 在该 stage 被调用。
 */
abstract class ParticleModule {
  abstract readonly stage: ParticleModuleStage;
  enabled = true;

  abstract execute (ctx: ParticleModuleContext): void;
}

export type { ParticleModuleStage, ParticleModuleContext };
export { ParticleModule };
