import { createValueGetter, ValueGetter } from '../../math';

interface BurstOptions {
  time: number,
  interval: number,
  count: number | ValueGetter<number>,
  cycles: number,
  probability: number,
}

export class Burst {
  private now: number;
  private index: number;
  private internalCycles: number;

  private readonly time: number;
  private readonly interval: number;
  private readonly count: ValueGetter<number>;
  private readonly cycles: number;
  private readonly probability: number;

  constructor (options: BurstOptions) {
    const { time, interval, count, cycles, probability } = options;

    this.time = +time || 0;
    this.interval = +interval || 1;
    this.count = count instanceof ValueGetter ? count : createValueGetter(count);
    this.cycles = +cycles || Infinity;
    this.probability = isNaN(probability) ? 1 : +probability;
    this.reset();
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
    const options = {
      time: this.time,
      interval: this.interval,
      count: this.count,
      cycles: this.cycles,
      probability: this.probability,
    };

    return new Burst(options);
  }
}
