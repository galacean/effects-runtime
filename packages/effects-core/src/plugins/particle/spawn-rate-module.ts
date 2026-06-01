import type { ValueGetter } from '../../math';

export type SpawnRateResult = {
  pointCount: number,
  interval: number,
  timeDelta: number,
};

/**
 * 发射速率计算模块。
 *
 * 从 ParticleSystem.update() 中提取的 rateOverTime 计数逻辑。
 * 仅计算本帧应发射的粒子数量和时间间隔，不执行实际发射。
 */
export class SpawnRateModule {
  private rateOverTime: ValueGetter<number>;
  private _lastEmitTime = 0;

  constructor (rateOverTime: ValueGetter<number>) {
    this.rateOverTime = rateOverTime;
    this._lastEmitTime = -1 / this.rateOverTime.getValue(0);
  }

  get lastEmitTime (): number {
    return this._lastEmitTime;
  }

  compute (timePassed: number, lifetime: number): SpawnRateResult {
    const interval = 1 / this.rateOverTime.getValue(lifetime);
    const pointCount = Math.floor((timePassed - this._lastEmitTime) / interval);
    const timeDelta = pointCount > 0 ? interval / pointCount : 0;

    return { pointCount, interval, timeDelta };
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
