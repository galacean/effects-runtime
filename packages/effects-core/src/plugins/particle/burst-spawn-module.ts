import type { vec3 } from '@galacean/effects-specification';
import type { Burst } from './burst';
import type { ParticleEmitter } from './particle-emitter';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext, ResolvedBurstSpawn } from './particle-module';

type BurstEmissionConfig = {
  bursts: Burst[],
  burstOffsets: Record<string, vec3[] | null>,
};

const ORIGIN_OFFSET: readonly [number, number, number] = [0, 0, 0];

/**
 * Burst 发射模块。对齐 particle-system-pro 的 ProSpawnBurstModule。
 *
 * stage = emitterUpdate。每帧检查 burst 的 canFire 条件，
 * 向 emitter.spawnInfos 推入带 burst 引用的 SpawnInfo。
 *
 * 注意：本模块只做时机检测（canFire，只读），不消耗 burst 状态。
 * 实际的 getGeneratorOptions（消耗 cycle）在 emitter spawn 阶段
 * 确认有可用 slot 后才调用，保留 burst 在满容量时的延迟触发语义。
 */
export class BurstSpawnModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private emission: BurstEmissionConfig;
  private lastTimePassed = 0;

  constructor (emission: BurstEmissionConfig) {
    super();
    this.emission = emission;
  }

  get bursts (): Burst[] {
    return this.emission.bursts;
  }

  get burstOffsets (): Record<string, vec3[] | null> {
    return this.emission.burstOffsets;
  }

  override execute (ctx: ParticleModuleContext): void {
    const bursts = this.emission.bursts;
    const emitter = ctx.emitter;
    const timePassed = emitter.timePassed;

    if (timePassed < this.lastTimePassed) {
      bursts.forEach(b => b.reset());
    }
    this.lastTimePassed = timePassed;

    for (let j = bursts.length - 1; j >= 0; j--) {
      const burst = bursts[j];

      if (!burst.canFire(timePassed)) {
        continue;
      }

      const burstIndex = j;

      emitter.spawnInfos.push({
        kind: 'burst',
        // 延迟求值：emitter 确认有可用 slot 后才调用，此时才消耗 burst 状态，
        // 保留满容量时「不消耗、下一帧补发」的语义。
        prepare: () => this.resolveBurst(emitter, burst, burstIndex),
      });
    }
  }

  /**
   * 消耗 burst cycle 状态并产出本次 spawn 参数。emitter 在确认有可用 slot 后调用。
   * 返回 null 表示本次不发射（cycle 耗尽 / 概率未命中）。
   */
  private resolveBurst (emitter: ParticleEmitter, burst: Burst, burstIndex: number): ResolvedBurstSpawn | null {
    const opts = burst.getGeneratorOptions(emitter.timePassed, emitter.emitterLifetime);

    if (!opts) {
      return null;
    }

    const offsets = this.emission.burstOffsets[burstIndex];
    const burstOffset = (offsets && offsets[opts.cycleIndex]) || ORIGIN_OFFSET;

    if (burst.once) {
      this.emission.burstOffsets[burstIndex] = null;
      this.emission.bursts.splice(burstIndex, 1);
    }

    return {
      count: opts.count,
      positionOffset: burstOffset,
      generator: {
        total: opts.total,
        index: opts.index,
        useGeneratedCountIndex: false,
        burstCount: opts.count,
      },
    };
  }
}
