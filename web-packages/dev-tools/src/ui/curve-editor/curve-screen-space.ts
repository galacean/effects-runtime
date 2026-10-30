import type { CurveBounds, CurveRect } from './curve-model';

export function curveTickStep (rough: number): number {
  const base = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-8))));
  const fraction = rough / base;

  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * base;
}

export class CurveScreenSpace {
  constructor (readonly rect: CurveRect, readonly bounds: CurveBounds) { }

  get pixelsPerSecond (): number { return this.rect.width / Math.max(1e-6, this.bounds.timeMax - this.bounds.timeMin); }
  timeX (time: number): number { return this.rect.x + (time - this.bounds.timeMin) * this.pixelsPerSecond; }
  timeAt (x: number): number { return this.bounds.timeMin + (x - this.rect.x) / this.pixelsPerSecond; }
  valueY (value: number): number { return this.rect.y + (this.bounds.valueMax - value) / Math.max(1e-12, this.bounds.valueMax - this.bounds.valueMin) * this.rect.height; }
  valueAt (y: number): number { return this.bounds.valueMax - (y - this.rect.y) / Math.max(1, this.rect.height) * (this.bounds.valueMax - this.bounds.valueMin); }
  contains (x: number, y: number, margin = 0): boolean { return Number.isFinite(x) && Number.isFinite(y) && x >= this.rect.x - margin && x <= this.rect.x + this.rect.width + margin && y >= this.rect.y - margin && y <= this.rect.y + this.rect.height + margin; }

  clipSegment (x1: number, y1: number, x2: number, y2: number): number[] | undefined {
    const left = this.rect.x, right = left + this.rect.width, top = this.rect.y, bottom = top + this.rect.height;
    const dx = x2 - x1, dy = y2 - y1;

    if (![x1, y1, x2, y2, dx, dy].every(Number.isFinite)) { return; }
    if (Math.max(x1, x2) < left || Math.min(x1, x2) > right || Math.max(y1, y2) < top || Math.min(y1, y2) > bottom) { return; }
    let from = 0, to = 1;
    const p = [-dx, dx, -dy, dy], q = [x1 - left, right - x1, y1 - top, bottom - y1];

    for (let index = 0; index < 4; index++) {
      if (p[index] === 0) { if (q[index] < 0) { return; } } else {
        const ratio = q[index] / p[index];

        if (p[index] < 0) { from = Math.max(from, ratio); } else { to = Math.min(to, ratio); }
        if (from > to) { return; }
      }
    }

    return [Math.max(left, Math.min(right, x1 + from * dx)), Math.max(top, Math.min(bottom, y1 + from * dy)),
      Math.max(left, Math.min(right, x1 + to * dx)), Math.max(top, Math.min(bottom, y1 + to * dy))];
  }
}

export function zoomCurveBounds (bounds: CurveBounds, timeFactor: number, valueFactor: number, time: number, value: number): CurveBounds {
  const timeRange = bounds.timeMax - bounds.timeMin, valueRange = bounds.valueMax - bounds.valueMin;
  const x = Math.max(1e-6 / timeRange, Math.min(36000 / timeRange, timeFactor));
  const y = Math.max(1e-8 / valueRange, Math.min(1e12 / valueRange, valueFactor));
  const result = { timeMin: time + (bounds.timeMin - time) * x, timeMax: time + (bounds.timeMax - time) * x,
    valueMin: value + (bounds.valueMin - value) * y, valueMax: value + (bounds.valueMax - value) * y };

  return Object.values(result).every(Number.isFinite) && result.timeMax > result.timeMin && result.valueMax > result.valueMin ? result : bounds;
}
