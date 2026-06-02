import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
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
 * 模块执行上下文。对齐 particle-system-pro 的 ProModuleContext。
 * 模块通过 emitter 引用访问共享状态（如 spawnInfos）。
 */
type ParticleModuleContext = {
  deltaTime: number,
  currentTime: number,
  emitterLifetime: number,
  duration: number,
  dataBuffer: ParticleDataBuffer,
  emitter: ParticleEmitter,
  firstIndex: number,
  lastIndex: number,
};

/**
 * particleSpawn 阶段的扩展上下文。
 * 提供 spawn 专用的状态：世界矩阵、待初始化的 slot 列表。
 */
type ParticleSpawnContext = ParticleModuleContext & {
  worldMatrix: Matrix4,
  slotIndices: number[],
};

type SpawnInfo = {
  count: number,
  timeDelta: number,
  isBurst?: boolean,
  burstIndex?: number,
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

export type { ParticleModuleStage, ParticleModuleContext, ParticleSpawnContext, SpawnInfo };
export { ParticleModule };
