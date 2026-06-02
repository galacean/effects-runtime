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
  private _lastEmitTime = 0;

  constructor (rateOverTime: ValueGetter<number>) {
    super();
    this.rateOverTime = rateOverTime;
    this._lastEmitTime = -1 / this.rateOverTime.getValue(0);
  }

  get lastEmitTime (): number {
    return this._lastEmitTime;
  }

  override execute (ctx: ParticleModuleContext): void {
    const timePassed = ctx.currentTime - ctx.emitter.loopStartTime;
    const lifetime = ctx.emitterLifetime;
    const interval = 1 / this.rateOverTime.getValue(lifetime);
    const pointCount = Math.floor((timePassed - this._lastEmitTime) / interval);

    if (pointCount > 0) {
      const timeDelta = interval / pointCount;

      ctx.emitter.spawnInfos.push({ count: pointCount, timeDelta });
    }
  }

  commitEmit (timePassed: number): void {
    this._lastEmitTime = timePassed;
  }

  adjustForLoop (duration: number): void {
    this._lastEmitTime -= duration;
  }

  reset (rateOverTime: ValueGetter<number>): void {
    this.rateOverTime = rateOverTime;
    this._lastEmitTime = -1 / this.rateOverTime.getValue(0);
  }
}
