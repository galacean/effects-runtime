import type { ValueGetter } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

/**
 * 发射速率模块。对齐 particle-system-pro 的 ProSpawnRateModule。
 *
 * stage = emitterUpdate。每帧计算应发射的粒子数量，
 * 写入 emitter.spawnInfos（不用返回值）。
 */
export class SpawnRateModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private rateOverTime: ValueGetter<number>;

  constructor (rateOverTime: ValueGetter<number>) {
    super();
    this.rateOverTime = rateOverTime;
  }

  /**
   * 无状态处理器：发射进度（lastEmitTime）作为 emitter 的共享 spawn 状态，
   * 由 emitter 在 spawn 末尾推进、在 reset / loop 时调整。本模块只读它来计算
   * 本帧应发射数量，不在自身持有任何跨帧状态。
   */
  override execute (ctx: ParticleModuleContext): void {
    const timePassed = ctx.currentTime - ctx.emitter.loopStartTime;
    const lifetime = ctx.emitterLifetime;
    const interval = 1 / this.rateOverTime.getValue(lifetime);
    const pointCount = Math.floor((timePassed - ctx.emitter.lastEmitTime) / interval);

    if (pointCount > 0) {
      const timeDelta = interval / pointCount;

      ctx.emitter.spawnInfos.push({
        kind: 'rate',
        count: pointCount,
        timeDelta,
        generator: {
          total: this.rateOverTime.getValue(lifetime),
          index: 0,
          useGeneratedCountIndex: true,
          burstCount: 0,
        },
      });
    }
  }
}
