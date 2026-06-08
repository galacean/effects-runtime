import type { vec3 } from '@galacean/effects-specification';
import type { BurstData } from './burst';
import { Burst } from './burst';
import type { ParticleEmitter } from './particle-emitter';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext, ResolvedBurstSpawn } from './particle-module';

export type BurstSpawnModuleData = {
  bursts: BurstData[],
  burstOffsets: Record<string, vec3[] | null>,
};

const ORIGIN_OFFSET: readonly [number, number, number] = [0, 0, 0];

/**
 * Burst 发射模块。对齐 particle-system-pro 的 ProSpawnBurstModule。
 *
 * stage = emitterUpdate。每帧检查 burst 的 canFire 条件，
 * 向 emitter.spawnInfos 推入带 prepare 回调的 SpawnInfo。
 *
 * 自检测 loop 回绕（timePassed 下降时重置 burst 状态）。
 */
export class BurstSpawnModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private bursts: Burst[] = [];
  private burstOffsets: Record<string, vec3[] | null> = {};
  private lastTimePassed = 0;

  override fromJSON (data: BurstSpawnModuleData): void {
    this.bursts = data.bursts.map(opts => new Burst(opts));
    this.burstOffsets = data.burstOffsets;
  }

  override execute (ctx: ParticleModuleContext): void {
    const bursts = this.bursts;
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
        prepare: () => this.resolveBurst(emitter, burst, burstIndex),
      });
    }
  }

  private resolveBurst (emitter: ParticleEmitter, burst: Burst, burstIndex: number): ResolvedBurstSpawn | null {
    const opts = burst.getGeneratorOptions(emitter.timePassed, emitter.emitterLifetime);

    if (!opts) {
      return null;
    }

    const offsets = this.burstOffsets[burstIndex];
    const burstOffset = (offsets && offsets[opts.cycleIndex]) || ORIGIN_OFFSET;

    if (burst.once) {
      this.burstOffsets[burstIndex] = null;
      this.bursts.splice(burstIndex, 1);
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
