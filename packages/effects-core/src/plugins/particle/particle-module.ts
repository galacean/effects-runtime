import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleEmitter } from './particle-emitter';

/**
 * 粒子模块执行阶段。对齐 particle-system-pro 的 ProModuleStage。
 */
export enum ParticleModuleStage {
  EmitterSpawn = 'emitterSpawn',
  EmitterUpdate = 'emitterUpdate',
  ParticleSpawn = 'particleSpawn',
  ParticleUpdate = 'particleUpdate',
}

/**
 * particleSpawn 阶段的 batch 元信息。
 * 对齐 particle-system-pro 的 ProSpawnBatchContext。
 */
type SpawnBatchContext = {
  /** 本批次待初始化的 slot 列表 */
  slotIndices: number[],
  /** 与 slotIndices 一一对应的逐粒子分布参数，供 InitializeParticleModule 算 shape 分布 */
  spawnGenerators: ShapeGeneratorOptions[],
};

/**
 * 模块执行上下文。对齐 particle-system-pro 的 ProModuleContext：
 * 单一 context，按 stage 约定哪些字段有效。
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
  /**
   * 是否为「首帧更新」批次：spawn 后针对本帧新生粒子 [firstIndex, lastIndex)
   * 的一次性 particleUpdate。用于让模块区分主更新（全量旧粒子）与首帧更新。
   */
  isFirstFrameUpdate: boolean,
  /** 仅 particleSpawn 阶段有值，其它 stage 为 undefined */
  spawnBatch?: SpawnBatchContext,
};

/**
 * spawn 批次的分布描述（批次级）。emitter 据此为每颗粒子展开出
 * 逐粒子的 ShapeGeneratorOptions。
 */
type SpawnGenerator = {
  total: number,
  index: number,
  /** rate 来源：index 按 emitter.totalSpawnedParticles 逐粒子递增；burst 来源：index 固定 */
  useGeneratedCountIndex: boolean,
  /** burst 一次发射的粒子总数（弧形等确定性分布用），rate 为 0 */
  burstCount: number,
};

/**
 * Spawn 请求。emitterUpdate 阶段由 SpawnRate/Burst 模块写入 emitter.spawnInfos。
 *
 * spawn 阶段按 spawnInfos 顺序消费共享的 maxCount 预算，buffer 满则后续
 * spawnInfo 被 clamp 丢弃
 */
type SpawnInfo = {
  count: number,
  timeDelta: number,
  positionOffset: readonly [number, number, number] | null,
  generator: SpawnGenerator,
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

  /**
   * 从 JSON 可序列化数据恢复模块状态。子类 override 实现。
   * 对齐 particle-system-pro 的 ProModule.fromJSON。
   */
  fromJSON (_data: unknown): void {
    // no-op by default
  }
}

/**
 * 依赖其它 emitter 运行时数据的模块（如 trail 的 SpawnPerSource / SampleFromSource）。
 *
 * 跨 emitter 引用以数据描述、在构造之后由独立的 binding resolve 步骤（setSource）
 * 注入实际 instance。
 */
interface SourceDependentModule {
  setSource (source: ParticleEmitter): void,
}

function isSourceDependent (m: ParticleModule): m is ParticleModule & SourceDependentModule {
  return 'setSource' in m;
}

export type { ParticleModuleContext, SpawnBatchContext, SpawnInfo, SpawnGenerator, SourceDependentModule };
export { ParticleModule, isSourceDependent };
