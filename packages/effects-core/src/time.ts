/** Per-stage timing data. All times are unscaled milliseconds. */
export class TickData {
  deltaTime = 0;
  protected lastBegin = 0;
  private lastTime = 0;
  private accumulator = 0;

  onTickBegin (time: number, fps: number, maxDeltaTime: number, force = false): boolean {
    const step = 1000 / fps;

    this.accumulator += Math.max(time - this.lastTime, 0);
    this.lastTime = time;
    if (!force && this.accumulator + 1e-7 < step) {
      return false;
    }
    const dt = Math.min(Math.max(time - this.lastBegin, 0), maxDeltaTime);

    // Consume one interval and retain at most one interval of catch-up time.
    this.accumulator = force ? 0 : Math.min(Math.max(this.accumulator - step, 0), step);
    this.lastBegin = time;
    this.deltaTime = dt;

    return true;
  }
}

/** FixedStepTickData: fixed while keeping up, elapsed steps when slow. */
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
 * Time layer, owned per engine to isolate multiple players.
 * Caller deltas drive the clock so manual ticks do not depend on wall time.
 */
export class Time {
  readonly update = new TickData();
  readonly physics = new FixedStepTickData();
  readonly draw = new TickData();
  private time = 0;
  private hasElapsed = false;

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
