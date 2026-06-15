import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type SpawnRateModuleData = {
  rateOverTime: spec.NumberExpression | number,
};

/**
 * 发射速率模块。对齐 particle-system-pro 的 ProSpawnRateModule。
 *
 * stage = emitterUpdate。每帧计算应发射的粒子数量，
 * 写入 emitter.spawnInfos。
 */
export class SpawnRateModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private rateOverTime!: ValueGetter<number>;
  private lastEmitTime = 0;
  private initialLastEmitTime = 0;

  override fromJSON (data: SpawnRateModuleData): void {
    this.rateOverTime = createValueGetter(data.rateOverTime);
    const rate = this.rateOverTime.getValue(0);

    this.initialLastEmitTime = rate > 0 ? -1 / rate : 0;
    this.lastEmitTime = this.initialLastEmitTime;
  }

  resetEmitTime (): void {
    this.lastEmitTime = this.initialLastEmitTime;
  }

  commitEmitTime (timePassed: number): void {
    this.lastEmitTime = timePassed;
  }

  override execute (ctx: ParticleModuleContext): void {
    const timePassed = ctx.emitter.timePassed;
    const lifetime = ctx.emitterLifetime;
    const rate = this.rateOverTime;
    const interval = 1 / rate.getValue(lifetime);
    const pointCount = Math.floor((timePassed - this.lastEmitTime) / interval);

    if (pointCount > 0) {
      const timeDelta = interval / pointCount;

      ctx.emitter.spawnInfos.push({
        kind: 'rate',
        count: pointCount,
        timeDelta,
        generator: {
          total: rate.getValue(lifetime),
          index: 0,
          useGeneratedCountIndex: true,
          burstCount: 0,
        },
      });
    }
  }
}
