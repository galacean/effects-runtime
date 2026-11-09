import type { VariableWidthPoint } from './stroke-attributes';

type Side = 'ascent' | 'descent';

/** Cubic Hermite interpolation with weighted harmonic interior tangents. */
export class StrokeWidthProfile {
  readonly points: VariableWidthPoint[];
  private slopes: Record<Side, number[]>;

  constructor (points: readonly VariableWidthPoint[], segmentIds: readonly number[]) {
    const ids = new Set(segmentIds);
    const sorted = points.filter(point => point.segmentId === undefined || ids.has(point.segmentId))
      .map(point => ({ ...point, position: Math.max(0, Math.min(1, point.position)), ascent: Math.max(0, point.ascent), descent: Math.max(0, point.descent) }))
      .sort((a, b) => a.position - b.position);
    const merged: VariableWidthPoint[] = [];

    for (const point of sorted) {
      const previous = merged[merged.length - 1];

      if (previous?.position === point.position) {
        previous.ascent = Math.max(previous.ascent, point.ascent);
        previous.descent = Math.max(previous.descent, point.descent);
      } else {
        merged.push(point);
      }
    }
    if (merged[0]?.position !== 0) {
      merged.unshift({ position: 0, ascent: 0.5, descent: 0.5 });
    }
    if (merged[merged.length - 1]?.position !== 1) {
      merged.push({ position: 1, ascent: 0.5, descent: 0.5 });
    }
    this.points = merged;
    this.slopes = { ascent: this.makeSlopes('ascent'), descent: this.makeSlopes('descent') };
  }

  private makeSlopes (side: Side): number[] {
    const points = this.points;
    const spans = points.slice(1).map((point, i) => point.position - points[i].position);
    const secants = points.slice(1).map((point, i) => (point[side] - points[i][side]) / spans[i]);
    const slopes = [secants[0]];

    for (let i = 1; i < points.length - 1; i++) {
      slopes.push(secants[i - 1] * secants[i] <= 0 ? 0
        : (spans[i - 1] + spans[i]) / (spans[i - 1] / secants[i - 1] + spans[i] / secants[i]));
    }
    slopes.push(secants[secants.length - 1]);
    const last = points.length - 1;

    // Sharpen a zero-width tip where the next width control has a flat tangent.
    if (points[0][side] === 0) {
      if (slopes[1] === 0) { slopes[0] *= 2; }
    } else if (slopes[2] === 0) {
      slopes[1] *= 2;
    }
    if (points[last][side] === 0) {
      if (slopes[last - 1] === 0) { slopes[last] *= 2; }
    } else if (slopes[last - 2] === 0) {
      slopes[last - 1] *= 2;
    }

    return slopes;
  }

  sample (position: number, side: Side): { value: number, derivative: number } {
    const points = this.points;
    const positionInRange = Math.max(0, Math.min(1, position));
    let lo = 0;
    let hi = points.length - 1;

    while (hi - lo > 1) {
      const middle = (lo + hi) >> 1;

      if (points[middle].position < positionInRange) { lo = middle; } else { hi = middle; }
    }
    const a = points[lo], b = points[hi];
    const span = b.position - a.position;
    const t = (positionInRange - a.position) / span;
    const t2 = t * t, t3 = t2 * t;
    const first = this.slopes[side][lo], second = this.slopes[side][hi];
    const value = (2 * t3 - 3 * t2 + 1) * a[side] + (t3 - 2 * t2 + t) * span * first
      + (-2 * t3 + 3 * t2) * b[side] + (t3 - t2) * span * second;
    const derivative = ((6 * t2 - 6 * t) * a[side] + (-6 * t2 + 6 * t) * b[side]) / span
      + (3 * t2 - 4 * t + 1) * first + (3 * t2 - 2 * t) * second;

    return { value: Math.max(0, value), derivative: value >= 0 ? derivative : 0 };
  }
}
