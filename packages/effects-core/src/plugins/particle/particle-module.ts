import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleEmitter } from './particle-emitter';

/**
 * 粒子模块执行阶段。对齐 particle-system-pro 的 ProModuleStage。
 */
type ParticleModuleStage =
  | 'emitterSpawn'
  | 'emitterUpdate'
  | 'particleSpawn'
  | 'particleUpdate';

/**
 * 模块执行上下文。对齐 particle-system-pro 的 ProModuleContext：
 * 单一 context，按 stage 约定哪些字段有效。
 *
 * 末尾的 spawn 专属字段仅在 particleSpawn 阶段被填充，其它 stage 为 undefined。
 * particleSpawn 的 module 在入口处守卫这些字段即可，无需类型强转。
 */
type ParticleModuleContext = {
  /** 帧间隔（秒） */
  deltaTime: number,
  currentTime: number,
  emitterLifetime: number,
  duration: number,
  dataBuffer: ParticleDataBuffer,
  emitter: ParticleEmitter,
  firstIndex: number,
  lastIndex: number,
  // --- particleSpawn 阶段专属 batch 元信息（其它 stage 为 undefined）---
  /** 世界矩阵 */
  worldMatrix?: Matrix4,
  /** 本批次待初始化的 slot 列表 */
  slotIndices?: number[],
  /** 与 slotIndices 一一对应的逐粒子分布参数，供 InitializeParticleModule 算 shape 分布 */
  spawnGenerators?: ShapeGeneratorOptions[],
  /** burst 发射偏移；rate 来源为 null */
  positionOffset?: readonly [number, number, number] | null,
};

/**
 * spawn 批次的分布描述（批次级）。emitter 据此为每颗粒子展开出
 * 逐粒子的 ShapeGeneratorOptions。
 */
type SpawnGenerator = {
  total: number,
  index: number,
  /** rate 来源：index 按 emitter.generatedCount 逐粒子递增；burst 来源：index 固定 */
  useGeneratedCountIndex: boolean,
  /** burst 一次发射的粒子总数（弧形等确定性分布用），rate 为 0 */
  burstCount: number,
};

/**
 * burst 延迟求值的结果。emitter 在 spawn 阶段确认有可用 slot 后，
 * 通过 BurstSpawnInfo.prepare() 拿到最终的 count / 偏移 / generator。
 */
type ResolvedBurstSpawn = {
  count: number,
  positionOffset: readonly [number, number, number],
  generator: SpawnGenerator,
};

/**
 * rate 来源：spawn 参数本帧已就绪，emitter 直接消费。
 */
type RateSpawnInfo = {
  kind: 'rate',
  count: number,
  timeDelta: number,
  generator: SpawnGenerator,
};

/**
 * burst 来源：携带延迟准备逻辑。emitter 在 spawn 循环中确认有可用 slot 后
 * 调用 prepare()，此时才消耗 burst cycle 状态。返回 null 表示本次不发射
 * （cycle 耗尽 / 概率未命中），保留「满容量则不消耗、下一帧补发」的时序。
 */
type BurstSpawnInfo = {
  kind: 'burst',
  prepare: () => ResolvedBurstSpawn | null,
};

type SpawnInfo = RateSpawnInfo | BurstSpawnInfo;

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

export type { ParticleModuleStage, ParticleModuleContext, SpawnInfo, RateSpawnInfo, BurstSpawnInfo, SpawnGenerator, ResolvedBurstSpawn };
export { ParticleModule };
