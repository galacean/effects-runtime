import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import type * as spec from '@galacean/effects-specification';

export type BurstData = {
  time: number,
  interval: number,
  count: spec.NumberExpression | number,
  cycles: number,
  probability: number,
};

export class Burst {
  once: boolean;
  disabled: boolean;

  private now: number;
  private index: number;
  private internalCycles: number;

  private readonly time: number;
  private readonly interval: number;
  private readonly count: ValueGetter<number>;
  private readonly cycles: number;
  private readonly probability: number;

  constructor (options: BurstData) {
    const { time, interval, count, cycles, probability } = options;

    this.time = +time || 0;
    this.interval = +interval || 1;
    this.count = createValueGetter(count);
    this.cycles = +cycles || Infinity;
    this.probability = isNaN(probability) ? 1 : +probability;
    this.reset();
  }

  canFire (timePassed: number): boolean {
    if (this.disabled) {
      return false;
    }
    const dt = timePassed - this.time - this.now;

    return dt > this.interval * this.index && this.internalCycles > 0;
  }

  getGeneratorOptions (timePassed: number, lifetime: number) {
    const dt = timePassed - this.time - this.now;

    if (dt > this.interval * this.index && this.internalCycles > 0) {
      this.internalCycles--;
      this.index++;

      return Math.random() <= this.probability ? {
        index: this.index,
        total: 1 / this.interval,
        count: this.count.getValue(lifetime),
        cycleIndex: this.cycles - this.internalCycles - 1,
      } : null;
    }
  }

  reset () {
    this.internalCycles = this.cycles;
    this.index = 0;
    this.now = 0;
  }

  clone (): Burst {
    const options: BurstData = {
      time: this.time,
      interval: this.interval,
      count: this.count as any,
      cycles: this.cycles,
      probability: this.probability,
    };

    return new Burst(options);
  }
}
