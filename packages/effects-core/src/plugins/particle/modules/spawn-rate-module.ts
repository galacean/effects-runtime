import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../../math';
import { createValueGetter } from '../../../math';
import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';

export type SpawnRateModuleData = {
  rateOverTime: spec.NumberExpression | number,
};

/**
 * 发射速率模块（无状态）。
 *
 * 只负责提供 rate 值和计算 spawn 数量。
 * 余数（spawnFraction）由 emitter 管理。
 */
export class SpawnRateModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

  private rateOverTime!: ValueGetter<number>;

  override fromJSON (data: SpawnRateModuleData): void {
    this.rateOverTime = createValueGetter(data.rateOverTime);
  }

  override execute (ctx: ParticleModuleContext): void {
    const lifetime = ctx.emitterLifetime;
    const rate = this.rateOverTime.getValue(lifetime);
    const newLeftover = ctx.emitter.spawnFraction + ctx.deltaTime * rate;
    const count = Math.floor(newLeftover);

    ctx.emitter.spawnFraction = newLeftover - count;

    if (count > 0) {
      const interval = rate > 0 ? 1 / rate : 0;

      ctx.emitter.spawnInfos.push({
        count,
        timeDelta: interval,
        positionOffset: null,
        generator: {
          total: rate,
          index: 0,
          useGeneratedCountIndex: true,
          burstCount: 0,
        },
      });
    }
  }
}
