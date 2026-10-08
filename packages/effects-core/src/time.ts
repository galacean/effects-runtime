/** Per-stage timing data. All times are unscaled milliseconds. */
export class TickData {
  deltaTime = 0;
  protected lastBegin = 0;
  protected nextBegin = 0;

  constructor (fps = 60) {
    this.nextBegin = 1000 / fps;
  }

  onTickBegin (time: number, fps: number, maxDeltaTime: number, force = false): boolean {
    if (!force && time + 1e-7 < this.nextBegin) {
      return false;
    }
    let dt = Math.max(time - this.lastBegin, 0);

    if (dt > maxDeltaTime) {
      dt = maxDeltaTime;
      this.nextBegin = time;
    }
    const step = 1000 / fps;

    this.nextBegin += Math.max(1, Math.floor((time - this.nextBegin + 1e-7) / step) + 1) * step;
    if (force) {
      this.nextBegin = time + step;
    }
    this.lastBegin = time;
    this.deltaTime = dt;

    return true;
  }
}

/** Flax FixedStepTickData: fixed while keeping up, elapsed steps when slow. */
export class FixedStepTickData extends TickData {
  private readonly samples: number[] = [];

  override onTickBegin (time: number, fps: number, maxDeltaTime: number): boolean {
    if (!super.onTickBegin(time, fps, maxDeltaTime)) {
      return false;
    }
    this.samples.push(this.deltaTime);
    if (this.samples.length > 4) {
      this.samples.shift();
    }
    const step = 1000 / fps;
    const average = this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length;

    if (average <= 1.5 * step) {
      this.lastBegin = time - (this.deltaTime - step);
      this.deltaTime = step;
    }

    return true;
  }
}

/**
 * Flax-style Time layer, owned per engine to isolate multiple players.
 * Caller deltas drive the clock so manual ticks do not depend on wall time.
 */
export class Time {
  readonly update: TickData;
  readonly physics = new FixedStepTickData();
  readonly draw: TickData;
  private time = 0;
  private hasElapsed = false;

  constructor (fps = 60) {
    this.update = new TickData(fps);
    this.draw = new TickData(fps);
  }

  advance (dt: number): void {
    this.hasElapsed = Number.isFinite(dt) && dt > 0;
    if (this.hasElapsed) {
      this.time += dt;
    }
  }

  onBeginUpdate (fps: number, force = false): boolean {
    return this.update.onTickBegin(this.time, fps, force ? Infinity : 100, force);
  }

  onBeginPhysics (): boolean {
    return this.hasElapsed && this.physics.onTickBegin(this.time, 60, 100);
  }

  onBeginDraw (fps: number, force = false): boolean {
    return this.draw.onTickBegin(this.time, fps, 1000, force);
  }
}
