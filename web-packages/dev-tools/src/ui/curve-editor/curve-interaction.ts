import type { CurvePoint } from './curve-model';

export class CurveDragGesture {
  axis?: 'x' | 'y';
  moved = false;

  constructor (private x: number, private y: number) { }

  rebase (x: number, y: number): void { this.x = x; this.y = y; }

  update (x: number, y: number, constrain: boolean): { dx: number, dy: number } {
    const dx = x - this.x, dy = y - this.y;

    this.moved ||= Math.hypot(dx, dy) > 3;
    if (constrain && this.moved && !this.axis) { this.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; }
    if (!constrain) { this.axis = undefined; }

    return { dx, dy };
  }
}

export interface CurveKeySeed extends CurvePoint { minTime: number, maxTime: number, apply(position: CurvePoint): void }

export function moveCurveKeys (seeds: readonly CurveKeySeed[], timeDelta: number, valueDelta: number): void {
  if (!seeds.length) { return; }
  const low = Math.max(...seeds.map(seed => seed.minTime - seed.time));
  const high = Math.min(...seeds.map(seed => seed.maxTime - seed.time));
  const delta = Math.max(low, Math.min(high, timeDelta));

  seeds.forEach(seed => seed.apply({ time: seed.time + delta, value: seed.value + valueDelta }));
}

export class CurveSelection {
  static click (selected: Set<string>, ids: Iterable<string>, additive: boolean, subtract = false, initial = selected): void {
    for (const id of ids) {
      if (subtract || additive && initial.has(id)) { selected.delete(id); } else { selected.add(id); }
    }
  }
}
