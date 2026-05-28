import type { ProSimulationSpace } from '../../simulation/emitter-instance';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export type ProEmitterLoopBehavior = 'infinite' | 'once' | 'multiple';
export type ProEmitterInactiveResponse = 'complete' | 'kill';

export interface ProEmitterPropertiesModuleProps extends ProModuleProps {
  duration: ProDistributionFloatData,
  loopBehavior: ProEmitterLoopBehavior,
  loopCount: number,
  loopDelay: ProDistributionFloatData,
  maxParticleCount: number,
  simulationSpace: ProSimulationSpace,
  warmupTime: number,
  warmupTickDelta: number,
  randomSeed: number,
  recalculateDurationEachLoop: boolean,
  recalculateDelayEachLoop: boolean,
  delayFirstLoopOnly: boolean,
  inactiveResponse: ProEmitterInactiveResponse,
  fixedBounds: [[number, number, number], [number, number, number]] | null,
}

/**
 * Emitter 属性模块。EmitterSpawn 阶段执行一次，把 duration / loop /
 * capacity / simulationSpace / warmup / seed 等设置写到 emitterInstance 上。
 *
 * 与 Niagara 的 Emitter Spawn 阶段对应（Niagara 是把这些散落在 EmitterState
 * 和 EmitterScript 里，我们简化为单个 Module）。
 *
 * - duration：单次循环时长（秒）
 * - loopBehavior：infinite=永久循环；once=播一次；multiple=播 loopCount 次
 * - loopDelay：每次循环之间的延迟（秒）
 * - maxParticleCount：粒子缓冲上限
 * - simulationSpace：local=跟随物体；world=spawn 时烘焙世界坐标，之后独立
 * - warmupTime：首次激活时预跑的模拟秒数
 * - warmupTickDelta：预跑使用的 sub-tick 大小
 * - randomSeed：emitter 随机流种子；变化时重置流
 */
export class ProEmitterPropertiesModule extends ProModule {
  readonly stage = ProModuleStage.EmitterSpawn;

  duration: ProDistributionFloat = ProDistributionFloat.fromConstant(5);
  loopBehavior: ProEmitterLoopBehavior = 'infinite';
  loopCount = 1;
  loopDelay: ProDistributionFloat = ProDistributionFloat.fromConstant(0);
  maxParticleCount = 1024;
  simulationSpace: ProSimulationSpace = 'local';
  warmupTime = 0;
  warmupTickDelta = 1 / 30;
  randomSeed = 0x12345678;
  recalculateDurationEachLoop = false;
  recalculateDelayEachLoop = false;
  delayFirstLoopOnly = false;
  inactiveResponse: ProEmitterInactiveResponse = 'complete';
  fixedBounds: [[number, number, number], [number, number, number]] | null = null;

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    const rs = ctx.randomStream;

    emitter.duration = this.duration.sampleAtTime(rs.nextFloat(), 0);
    emitter.loopBehavior = this.loopBehavior;
    emitter.loopCount = this.loopCount;
    emitter.loopDelay = this.loopDelay.sampleAtTime(rs.nextFloat(), 0);
    emitter.maxInstanceCount = Math.max(1, Math.floor(this.maxParticleCount));
    emitter.simulationSpace = this.simulationSpace;
    emitter.warmupTime = Math.max(0, this.warmupTime);
    emitter.warmupTickDelta = Math.max(1 / 240, this.warmupTickDelta);
    emitter.applyRandomSeed((this.randomSeed + ctx.systemInstance.randomSeedOffset) | 0);
    emitter.recalculateDurationEachLoop = this.recalculateDurationEachLoop;
    emitter.recalculateDelayEachLoop = this.recalculateDelayEachLoop;
    emitter.delayFirstLoopOnly = this.delayFirstLoopOnly;
    emitter.inactiveResponse = this.inactiveResponse;

    const durationDist = this.duration;
    const delayDist = this.loopDelay;

    emitter.durationSampler = () => durationDist.sampleAtTime(rs.nextFloat(), 0);
    emitter.delaySampler = () => delayDist.sampleAtTime(rs.nextFloat(), 0);
  }

  override toJSON (): ProEmitterPropertiesModuleProps {
    return {
      duration: this.duration.toJSON(),
      loopBehavior: this.loopBehavior,
      loopCount: this.loopCount,
      loopDelay: this.loopDelay.toJSON(),
      maxParticleCount: this.maxParticleCount,
      simulationSpace: this.simulationSpace,
      warmupTime: this.warmupTime,
      warmupTickDelta: this.warmupTickDelta,
      randomSeed: this.randomSeed,
      recalculateDurationEachLoop: this.recalculateDurationEachLoop,
      recalculateDelayEachLoop: this.recalculateDelayEachLoop,
      delayFirstLoopOnly: this.delayFirstLoopOnly,
      inactiveResponse: this.inactiveResponse,
      fixedBounds: this.fixedBounds,
    };
  }

  override fromJSON (data: ProEmitterPropertiesModuleProps): void {
    if (data.duration) {
      this.duration = typeof data.duration === 'number'
        ? ProDistributionFloat.fromConstant(data.duration)
        : ProDistributionFloat.fromJSON(data.duration);
    }
    if (data.loopBehavior === 'infinite' || data.loopBehavior === 'once' || data.loopBehavior === 'multiple') {
      this.loopBehavior = data.loopBehavior;
    }
    if (typeof data.loopCount === 'number') { this.loopCount = data.loopCount; }
    if (data.loopDelay) {
      this.loopDelay = typeof data.loopDelay === 'number'
        ? ProDistributionFloat.fromConstant(data.loopDelay)
        : ProDistributionFloat.fromJSON(data.loopDelay);
    }
    if (typeof data.maxParticleCount === 'number') { this.maxParticleCount = data.maxParticleCount; }
    if (data.simulationSpace === 'local' || data.simulationSpace === 'world') {
      this.simulationSpace = data.simulationSpace;
    }
    if (typeof data.warmupTime === 'number') { this.warmupTime = data.warmupTime; }
    if (typeof data.warmupTickDelta === 'number') { this.warmupTickDelta = data.warmupTickDelta; }
    if (typeof data.randomSeed === 'number') { this.randomSeed = data.randomSeed; }
    if (typeof data.recalculateDurationEachLoop === 'boolean') { this.recalculateDurationEachLoop = data.recalculateDurationEachLoop; }
    if (typeof data.recalculateDelayEachLoop === 'boolean') { this.recalculateDelayEachLoop = data.recalculateDelayEachLoop; }
    if (typeof data.delayFirstLoopOnly === 'boolean') { this.delayFirstLoopOnly = data.delayFirstLoopOnly; }
    if (data.inactiveResponse === 'complete' || data.inactiveResponse === 'kill') {
      this.inactiveResponse = data.inactiveResponse;
    }
    if (data.fixedBounds && Array.isArray(data.fixedBounds) && data.fixedBounds.length === 2) {
      this.fixedBounds = [
        [data.fixedBounds[0][0], data.fixedBounds[0][1], data.fixedBounds[0][2]],
        [data.fixedBounds[1][0], data.fixedBounds[1][1], data.fixedBounds[1][2]],
      ];
    }
  }
}
