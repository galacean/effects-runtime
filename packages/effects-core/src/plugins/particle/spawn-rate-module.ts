import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { SpawnRateModuleData } from './parse-spec';

/**
 * 发射速率模块。对齐 particle-system-pro 的 ProSpawnRateModule。
 *
 * stage = emitterUpdate。每帧计算应发射的粒子数量，
 * 写入 emitter.spawnInfos。
 */
export class SpawnRateModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private data: SpawnRateModuleData;

  constructor (data: SpawnRateModuleData) {
    super();
    this.data = data;
  }

  override execute (ctx: ParticleModuleContext): void {
    const timePassed = ctx.currentTime - ctx.emitter.loopStartTime;
    const lifetime = ctx.emitterLifetime;
    const rate = this.data.rateOverTime;
    const interval = 1 / rate.getValue(lifetime);
    const pointCount = Math.floor((timePassed - ctx.emitter.lastEmitTime) / interval);

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
