import type { ProSimulationSpace } from '../../simulation/emitter-instance';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

export type ProEmitterLoopBehavior = 'infinite' | 'once' | 'multiple';

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

  duration = 5;
  loopBehavior: ProEmitterLoopBehavior = 'infinite';
  loopCount = 1;
  loopDelay = 0;
  maxParticleCount = 1024;
  simulationSpace: ProSimulationSpace = 'local';
  warmupTime = 0;
  warmupTickDelta = 1 / 30;
  randomSeed = 0x12345678;

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;

    emitter.duration = this.duration;
    emitter.loopBehavior = this.loopBehavior;
    emitter.loopCount = this.loopCount;
    emitter.loopDelay = this.loopDelay;
    emitter.maxInstanceCount = Math.max(1, Math.floor(this.maxParticleCount));
    emitter.simulationSpace = this.simulationSpace;
    emitter.warmupTime = Math.max(0, this.warmupTime);
    emitter.warmupTickDelta = Math.max(1 / 240, this.warmupTickDelta);
    emitter.applyRandomSeed(this.randomSeed | 0);
  }
}
