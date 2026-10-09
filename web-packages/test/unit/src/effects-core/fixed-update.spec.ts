import { Time } from '../../../../../packages/effects-core/src/time';
import { Ticker } from '../../../../../packages/effects-core/src/ticker';

const { expect } = chai;
const step = 1000 / 60;

function createClock () {
  const time = new Time();

  return {
    advance (dt: number) {
      time.advance(dt);

      return time.onBeginPhysics() ? time.physics.deltaTime : undefined;
    },
  };
}

describe('core/fixed-update', () => {
  it('schedules physics independently from 30 FPS updates and draws', () => {
    const time = new Time();
    const counts = [0, 0, 0];

    for (let i = 0; i < 120; i++) {
      time.advance(step / 2);
      if (time.onBeginUpdate(30)) { counts[0]++; }
      if (time.onBeginPhysics()) { counts[1]++; }
      if (time.onBeginDraw(30)) { counts[2]++; }
    }
    expect(counts).to.deep.equal([30, 60, 30]);
  });

  it('runs the main loop on every RAF and excludes paused wall time', () => {
    const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    let now = 0;
    const ticker = new Ticker(30);
    const loops: number[] = [];
    let frames = 0;

    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    try {
      ticker.add(dt => loops.push(dt));
      ticker.add(() => frames++);
      ticker.resume();
      for (let i = 0; i < 120; i++) {
        now = (i + 1) * step / 2;
        ticker.tick();
      }
      expect(loops).to.have.length(120);
      expect(frames).to.equal(120);
      ticker.pause();
      now += 5000;
      ticker.resume();
      now += step;
      ticker.tick();
      expect(loops[loops.length - 1]).to.be.closeTo(step, 1e-7);
    } finally {
      ticker.stop();
      if (descriptor) {
        Object.defineProperty(performance, 'now', descriptor);
      } else {
        Reflect.deleteProperty(performance, 'now');
      }
    }
  });
  it('waits for the fixed deadline at higher frame rates and preserves jitter', () => {
    const clock = createClock();

    expect(clock.advance(step / 2)).to.equal(undefined);
    expect(clock.advance(step / 2)).to.equal(step);
    expect(clock.advance(step + 1)).to.equal(step);
    expect(clock.advance(step - 1)).to.equal(step);
    expect(clock.advance(0)).to.equal(undefined);
  });

  it('keeps the 60Hz cadence over 120Hz frames', () => {
    const clock = createClock();
    const deltas: number[] = [];

    for (let i = 0; i < 120; i++) {
      const dt = clock.advance(1000 / 120);

      if (dt !== undefined) {
        deltas.push(dt);
      }
    }
    expect(deltas).to.have.length(60);
    expect(deltas.every(dt => dt === step)).to.equal(true);
  });

  it('uses elapsed steps when slow, clamps stalls, and recovers to fixed steps', () => {
    const clock = createClock();

    expect(clock.advance(step)).to.equal(step);
    expect(clock.advance(step)).to.equal(step);
    expect(clock.advance(step)).to.equal(step);
    expect(clock.advance(step * 2)).to.equal(step);
    expect(clock.advance(step * 2)).to.be.closeTo(step * 3, 1e-7);
    expect(clock.advance(1000)).to.equal(100);
    for (let i = 0; i < 4; i++) {
      clock.advance(step);
    }
    expect(clock.advance(step)).to.equal(step);
    expect(clock.advance(0)).to.equal(undefined);
  });

  it('retains at most one interval of catch-up time after a stall', () => {
    const time = new Time();

    time.advance(1000);
    expect(time.onBeginUpdate(60)).to.equal(true);
    expect(time.update.deltaTime).to.equal(100);
    time.advance(step * 0.25);
    expect(time.onBeginUpdate(60)).to.equal(true);
    expect(time.update.deltaTime).to.be.closeTo(step * 0.25, 1e-7);
    time.advance(step * 0.25);
    expect(time.onBeginUpdate(60)).to.equal(false);
    time.advance(step * 0.5);
    expect(time.onBeginUpdate(60)).to.equal(true);
  });

  it('preserves the target cadence when RAF timestamps alternate around deadlines', () => {
    const time = new Time();
    const counts = [0, 0, 0];
    let previous = 0;

    for (let i = 1; i <= 120; i++) {
      const now = i * step + (i % 2 ? 0.2 : -0.2);

      time.advance(now - previous);
      previous = now;
      if (time.onBeginUpdate(60)) { counts[0]++; }
      if (time.onBeginPhysics()) { counts[1]++; }
      if (time.onBeginDraw(60)) { counts[2]++; }
    }
    expect(counts).to.deep.equal([119, 119, 119]);
    expect(time.physics.deltaTime).to.equal(step);
  });

  it('ignores invalid deltas without poisoning the clock', () => {
    const clock = createClock();

    for (const dt of [0, -10, NaN, Infinity]) {
      expect(clock.advance(dt)).to.equal(undefined);
    }
    expect(clock.advance(step)).to.equal(step);
  });
});
