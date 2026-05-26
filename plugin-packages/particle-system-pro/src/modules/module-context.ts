import type { ProDataBuffer } from '../data/data-buffer';
import type { ProEmitterInstance } from '../simulation/emitter-instance';
import type { ProSystemInstance } from '../simulation/system-instance';
import type { ProPerSourceSpawnAssignment } from '../types/spawn-info';
import type { ProRandomStream } from '../utils/random-stream';

export type ProSpawnBatchContext = {
  execCountInBatch: number,
  spawnIntervalDt: number,
  interpSpawnStartDt: number,
  sourceAssignment: ProPerSourceSpawnAssignment | null,
};

/**
 * 单次 Module.execute 的输入上下文。
 *
 * - dataBuffer：仅 particle 阶段有效；其它阶段为 null
 * - firstInstance / lastInstance：粒子阶段处理 [first, last) 这段实例
 * - spawnBatch：仅 ParticleSpawn 阶段可能非 null；描述当前 spawn 批次的公共参数。
 *   批内每粒子的 execIndex 可用 `(i - firstInstance)` 推导
 * - randomStream：调用方应使用此流，不要直接 Math.random，否则破坏 deterministic
 */
export interface ProModuleContext {
  deltaTime: number,
  systemInstance: ProSystemInstance,
  emitterInstance: ProEmitterInstance,
  dataBuffer: ProDataBuffer | null,
  firstInstance: number,
  lastInstance: number,
  spawnBatch: ProSpawnBatchContext | null,
  randomStream: ProRandomStream,
}
