import type { vec3 } from '@galacean/effects-specification';
import type { BurstData } from '../core/burst';
import { Burst } from '../core/burst';
import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';

export type BurstSpawnModuleData = {
  bursts: BurstData[],
  burstOffsets: Record<string, vec3[] | null>,
};

const ORIGIN_OFFSET: readonly [number, number, number] = [0, 0, 0];

/**
 * Burst 发射模块。burst 触发时立即消耗 cycle 并写入 SpawnInfo，
 * buffer 满由 emitter 的共享预算 clamp 丢弃，不补发。
 *
 * stage = emitterUpdate。自检测 loop 回绕（timePassed 下降时重置 burst 状态）。
 */
export class BurstSpawnModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

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

      const opts = burst.getGeneratorOptions(timePassed, emitter.state.loopLifetime);

      if (!opts) {
        continue;
      }

      const offsets = this.burstOffsets[j];
      const burstOffset = (offsets && offsets[opts.cycleIndex]) || ORIGIN_OFFSET;

      if (burst.once) {
        this.burstOffsets[j] = null;
        this.bursts.splice(j, 1);
      }

      emitter.spawnInfos.push({
        count: opts.count,
        timeDelta: 0,
        positionOffset: burstOffset,
        generator: {
          total: opts.total,
          index: opts.index,
          useGeneratedCountIndex: false,
          burstCount: opts.count,
        },
      });
    }
  }
}
