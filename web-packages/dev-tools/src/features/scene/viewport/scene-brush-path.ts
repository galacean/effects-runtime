import { math } from '@galacean/effects';
import type { ContourPathCommand } from '../../../../../../packages/effects-core/src/plugins/shape/contour-path';

export interface BrushCurve {
  points: math.Vector2[],
  easingIns: math.Vector2[],
  easingOuts: math.Vector2[],
}

/** Uniform arc-length samples plus a live endpoint, independent of event frequency. */
export class BrushPathSampler {
  readonly points: math.Vector2[];
  readonly spacing: number;
  private readonly pointer: math.Vector2;
  private readonly tail: math.Vector2;
  private hasTail = false;
  private toNext: number;

  constructor (start: math.Vector2, spacing: number) {
    this.spacing = spacing;
    this.toNext = this.spacing;
    this.pointer = start.clone(); this.tail = start.clone(); this.points = [start.clone()];
  }

  add (position: math.Vector2): boolean {
    const dx = position.x - this.pointer.x, dy = position.y - this.pointer.y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-8) { return false; }
    if (this.hasTail) { this.points.pop(); this.hasTail = false; }
    let distance = this.toNext;

    while (distance <= length + 1e-8) {
      const t = Math.min(1, distance / length);

      this.points.push(new math.Vector2(this.pointer.x + dx * t, this.pointer.y + dy * t));
      distance += this.spacing;
    }
    this.toNext = distance - length;
    this.pointer.copyFrom(position);
    const last = this.points[this.points.length - 1];

    if (Math.hypot(position.x - last.x, position.y - last.y) > 1e-8) {
      this.points.push(this.tail.copyFrom(position)); this.hasTail = true;
    }

    return true;
  }
}

type CurveSegment = { start: math.Vector2, first: math.Vector2, second: math.Vector2, end: math.Vector2 };

/** Prune samples by distance and turn, fit midpoint cubics, then merge short aligned segments. */
export function createBrushCurve (samples: readonly math.Vector2[], smoothing: number): BrushCurve {
  const amount = smoothing / 100;

  if (samples.length < 3 || amount === 0) { return polylineCurve(samples); }
  const segments: CurveSegment[] = [];
  let previous = samples[1];
  let first = interpolate(samples[0], previous, .33), second = interpolate(samples[0], previous, .66);
  let start = interpolate(first, second, .5);

  for (let index = 2; index < samples.length; index++) {
    const point = samples[index], dx = point.x - previous.x, dy = point.y - previous.y;
    const length = Math.hypot(dx, dy);

    if (length < 3 * amount) { continue; }
    if (index < samples.length - 1) {
      const next = samples[index + 1], nx = next.x - point.x, ny = next.y - point.y;

      if ((dx * nx + dy * ny) / (length * Math.hypot(nx, ny)) > .995) { continue; }
    }
    const nextFirst = interpolate(previous, point, .33), nextSecond = interpolate(previous, point, .66);
    const end = interpolate(second, nextFirst, .5);

    segments.push({ start, first, second, end });
    start = end; first = nextFirst; second = nextSecond; previous = point;
  }
  if (!segments.length) { return polylineCurve([samples[0], samples[samples.length - 1]]); }
  mergeSegments(segments, 50 * amount);
  // Restore tangent direction after merging without changing handle lengths.
  for (let index = 1; index < segments.length - 1; index++) {
    const segment = segments[index], previous = segments[index - 1];
    const dx = segment.start.x - previous.second.x, dy = segment.start.y - previous.second.y;
    const length = Math.hypot(dx, dy);
    const handle = Math.hypot(segment.first.x - segment.start.x, segment.first.y - segment.start.y);

    if (length > 0) { segment.first = new math.Vector2(segment.start.x + dx * handle / length, segment.start.y + dy * handle / length); }
  }
  segments.push({ start: segments[segments.length - 1].end, first, second, end: samples[samples.length - 1] });
  const points = [samples[0].clone()], easingIns = [new math.Vector2()], easingOuts: math.Vector2[] = [];

  for (const segment of segments) {
    easingOuts.push(segment.first.clone().subtract(points[points.length - 1]));
    points.push(segment.end.clone());
    easingIns.push(segment.second.clone().subtract(segment.end));
  }
  easingOuts.push(new math.Vector2());

  return { points, easingIns, easingOuts };
}

function interpolate (a: math.Vector2, b: math.Vector2, t: number): math.Vector2 {
  return new math.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

function mergeSegments (segments: CurveSegment[], maxLength: number): void {
  for (let pass = 0; pass < 2 && segments.length >= 3; pass++) {
    let write = 0;

    for (let index = 0; index < segments.length; index++) {
      const a = segments[index], b = segments[index + 1];

      if (b) {
        const ax = a.end.x - a.start.x, ay = a.end.y - a.start.y, bx = b.end.x - b.start.x, by = b.end.y - b.start.y;
        const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);

        if (al + bl < maxLength && (ax * bx + ay * by) / (al * bl) > .85) {
          segments[write++] = { start: a.start, first: a.second, second: b.first, end: b.end };
          index++;
          continue;
        }
      }
      segments[write++] = a;
    }
    segments.length = write;
  }
}

function polylineCurve (samples: readonly math.Vector2[]): BrushCurve {
  const points = removeCollinear(samples);

  if (points.length === 2 && points[0].equals(points[1])) { points.pop(); }
  if (points.length === 1) { points.push(points[0].clone().add(new math.Vector2(.01, 0))); }

  return { points, easingIns: points.map(() => new math.Vector2()), easingOuts: points.map(() => new math.Vector2()) };
}

export function brushContour (curve: BrushCurve): ContourPathCommand[] {
  if (!curve.points.length) { return []; }
  const path: ContourPathCommand[] = [{ action: 'moveTo', data: [curve.points[0]] }];

  for (let index = 1; index < curve.points.length; index++) {
    path.push({ action: 'bezierCurveTo', data: [
      curve.points[index - 1].clone().add(curve.easingOuts[index - 1]),
      curve.points[index].clone().add(curve.easingIns[index]), curve.points[index],
    ] });
  }

  return path;
}

function removeCollinear (samples: readonly math.Vector2[]): math.Vector2[] {
  if (samples.length < 3) { return samples.map(point => point.clone()); }
  const result = [samples[0].clone()];

  for (let index = 1; index < samples.length - 1; index++) {
    const a = result[result.length - 1], b = samples[index], c = samples[index + 1];
    const x = b.x - a.x, y = b.y - a.y, dx = c.x - b.x, dy = c.y - b.y;

    if (Math.abs(x * dy - y * dx) > 1e-10 || x * dx + y * dy < 0) { result.push(b.clone()); }
  }
  result.push(samples[samples.length - 1].clone());

  return result;
}
