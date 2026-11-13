import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import * as spec from '@galacean/effects-specification';
import type { ContourPathCommand } from '../../plugins/shape/contour-path';
import type { TrimContourSource, TrimmedPathResult, TrimSegmentSource } from '../../plugins/shape/trimmed-path-result';
import type { StrokeAttributes } from './stroke-attributes';
import { buildAdaptiveBezier } from './build-adaptive-bezier';
import { clipContours } from './split-union';
import { StrokeWidthProfile } from './stroke-width-profile';

type Point = { x: number, y: number };
type Cubic = [Point, Point, Point, Point];
type Segment = { points: [Point, Point] | Cubic, segmentId: number, source?: TrimSegmentSource };
type StrokeContour = {
  path: ContourPathCommand[],
  segments: Segment[],
  closed: boolean,
  sourceClosed: boolean,
  sourceSegmentIds: readonly number[],
};
type CurveSample = { point: Point, velocity: Point };
type StrokeOutlineContour = { points: number[], closed: boolean };

const MAX_OFFSET_DEPTH = 9;
const QUARTER_CIRCLE_HANDLE = 0.5522847498307933;

function add (a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub (a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul (a: Point, scale: number): Point {
  return { x: a.x * scale, y: a.y * scale };
}

function dot (a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function cross (a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function same (a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function normal (a: Point): Point {
  return { x: -a.y, y: a.x };
}

function normalize (a: Point, length = 1): Point {
  const squared = dot(a, a);

  return squared !== 0 ? mul(a, length / Math.sqrt(squared)) : { x: 0, y: 0 };
}

function midpoint (a: Point, b: Point): Point {
  return mul(add(a, b), 0.5);
}

function evaluate (p: Cubic, t: number): Point {
  const s = 1 - t;

  return {
    x: s * (s * (s * p[0].x + 3 * t * p[1].x) + 3 * t * t * p[2].x) + t * t * t * p[3].x,
    y: s * (s * (s * p[0].y + 3 * t * p[1].y) + 3 * t * t * p[2].y) + t * t * t * p[3].y,
  };
}

function derivative (p: Cubic, t: number): Point {
  const s = 1 - t;

  return mul(add(add(mul(sub(p[1], p[0]), s * s), mul(sub(p[2], p[1]), 2 * s * t)), mul(sub(p[3], p[2]), t * t)), 3);
}

function offsetAt (p: Cubic, distance: number, t: number): Point {
  return add(evaluate(p, t), normal(normalize(derivative(p, t), distance)));
}

function curvature (p: Cubic, t: number): number {
  const velocity = derivative(p, t);
  const acceleration = mul(add(mul(add(sub(p[2], mul(p[1], 2)), p[0]), 1 - t), mul(add(sub(p[3], mul(p[2], 2)), p[1]), t)), 6);
  const speedSquared = dot(velocity, velocity);

  return speedSquared !== 0 ? cross(velocity, acceleration) / (speedSquared * Math.sqrt(speedSquared)) : 0;
}

function subdivide (p: Cubic): [Cubic, Cubic] {
  const a = midpoint(p[0], p[1]);
  const b = midpoint(p[1], p[2]);
  const c = midpoint(p[2], p[3]);
  const d = midpoint(a, b);
  const e = midpoint(b, c);
  const f = midpoint(d, e);

  return [[p[0], a, d, f], [f, e, c, p[3]]];
}

/** Solve the two handle lengths from endpoints, handle directions and the midpoint. */
function fitHandles (start: Point, startDirection: Point, endDirection: Point, end: Point, middle: Point): [number, number] {
  const a = mul(startDirection, 0.375);
  const b = mul(endDirection, 0.375);
  const target = sub(middle, midpoint(start, end));
  const second = cross(a, target) / cross(a, b);
  const first = Math.abs(a.x) > Math.abs(a.y)
    ? (target.x - second * b.x) / a.x
    : (target.y - second * b.y) / a.y;

  return [first, second];
}

/** Curvature bounds from the Bernstein coefficients of B' and B' × B''. */
function curvatureBounds (p: Cubic): { maxSign: number, max: number | null } {
  const a = sub(p[1], p[0]);
  const b = sub(p[2], p[1]);
  const c = sub(p[3], p[2]);
  const minCross = Math.min(2 * cross(a, b), cross(a, c), 2 * cross(b, c));
  const maxCross = Math.max(2 * cross(a, b), cross(a, c), 2 * cross(b, c));
  const speeds = [dot(a, a), dot(a, b), (2 * dot(b, b) + dot(a, c)) / 3, dot(b, c), dot(c, c)];
  const minSpeed = Math.min(...speeds);

  if (minSpeed <= 0) {
    return { maxSign: maxCross, max: null };
  }
  const maxSpeed = Math.max(...speeds);
  const denominators = [minSpeed * Math.sqrt(minSpeed), maxSpeed * Math.sqrt(maxSpeed)];

  return { maxSign: maxCross, max: Math.max(minCross / denominators[0], minCross / denominators[1], maxCross / denominators[0], maxCross / denominators[1]) / 3 };
}

class StrokeWriter {
  readonly commands: ContourPathCommand[] = [];

  constructor (private scale: number) { }

  private point (p: Point): Vector2 {
    return new Vector2(p.x / this.scale, p.y / this.scale);
  }

  move (p: Point): void {
    this.commands.push({ action: 'moveTo', data: [this.point(p)] });
  }

  line (p: Point): void {
    this.commands.push({ action: 'lineTo', data: [this.point(p)] });
  }

  cubic (p: Cubic): void {
    this.commands.push({ action: 'bezierCurveTo', data: [this.point(p[1]), this.point(p[2]), this.point(p[3])] });
  }

  close (): void {
    this.commands.push({ action: 'closePath', data: [] });
  }
}

/** Adaptive cubic offset with a control-polygon fallback at the subdivision limit. */
function offsetCubic (writer: StrokeWriter, p: Cubic, distance: number, errorSquared: number, depth = 0, start = true): void {
  const edges = [sub(p[1], p[0]), sub(p[2], p[1]), sub(p[3], p[2])];
  const normals = edges.map(edge => normal(normalize(edge)));
  const candidate: Cubic = [
    add(p[0], mul(normals[0], distance)),
    add(p[1], normalize(add(normals[0], normals[1]), distance)),
    add(p[2], normalize(add(normals[1], normals[2]), distance)),
    add(p[3], mul(normals[2], distance)),
  ];

  if (depth >= MAX_OFFSET_DEPTH) {
    if (start) {
      writer.line(candidate[0]);
    }
    writer.cubic(candidate);

    return;
  }
  const startDirection = curvature(p, 0) > 1 / distance ? mul(edges[0], -1) : edges[0];
  const endDirection = curvature(p, 1) > 1 / distance ? edges[2] : mul(edges[2], -1);
  const [first, second] = fitHandles(candidate[0], startDirection, endDirection, candidate[3], offsetAt(p, distance, 0.5));

  if (first > 0 && second > 0) {
    candidate[1] = add(candidate[0], mul(startDirection, first));
    candidate[2] = add(candidate[3], mul(endDirection, second));
    const error1 = sub(offsetAt(p, distance, 0.25), evaluate(candidate, 0.25));
    const error2 = sub(offsetAt(p, distance, 0.75), evaluate(candidate, 0.75));

    if (dot(error1, error1) + dot(error2, error2) < errorSquared) {
      if (start) {
        writer.line(candidate[0]);
      }
      writer.cubic(candidate);

      return;
    }
  }
  const [left, right] = subdivide(p);

  offsetCubic(writer, left, distance, errorSquared, depth + 1, start);
  offsetCubic(writer, right, distance, errorSquared, depth + 1, false);
}

/** Choose the offset tolerance and collapse an inner boundary that converges to a point. */
function offsetSide (writer: StrokeWriter, p: Cubic, distance: number): void {
  let errorSquared = (distance / 32) ** 2;
  const bounds = curvatureBounds(p);

  if (bounds.maxSign > 0 && (bounds.max === null || bounds.max > 1 / distance)) {
    const start = add(p[0], normal(normalize(sub(p[1], p[0]), distance)));
    const end = add(p[3], normal(normalize(sub(p[3], p[2]), distance)));
    const delta = sub(end, start);
    const lengthSquared = dot(delta, delta);

    if (lengthSquared < 1e-6 && [0.25, 0.5, 0.75].every(t => {
      const difference = sub(offsetAt(p, distance, t), start);

      return dot(difference, difference) <= 1e-4;
    })) {
      writer.line(start);
      writer.line(end);

      return;
    }
    errorSquared = Math.min(errorSquared, lengthSquared / 4096);
  }
  offsetCubic(writer, p, distance, errorSquared);
}

function expandSegment (writer: StrokeWriter, segment: Segment, radius: number): void {
  const p = segment.points;
  const end = p[p.length - 1];

  writer.move(p[0]);
  if (p.length === 2) {
    const n = normal(normalize(sub(end, p[0]), radius));

    writer.line(add(p[0], n));
    writer.line(add(end, n));
    writer.line(end);
    writer.line(sub(end, n));
    writer.line(sub(p[0], n));
  } else {
    offsetSide(writer, p, radius);
    writer.line(end);
    offsetSide(writer, [p[3], p[2], p[1], p[0]], radius);
  }
  writer.close();
}

function tangent (segment: Segment, atEnd: boolean): Point {
  const p = segment.points;
  const origin = atEnd ? p[p.length - 1] : p[0];

  for (let i = 1; i < p.length; i++) {
    const direction = atEnd ? sub(origin, p[p.length - 1 - i]) : sub(p[i], origin);

    if (dot(direction, direction) > 0) {
      return direction;
    }
  }

  return { x: 0, y: 0 };
}

function roundJoin (writer: StrokeWriter, center: Point, start: Point, end: Point, radius: number): void {
  const cosine = Math.max(-1, Math.min(1, dot(start, end) / (radius * radius)));
  const angle = Math.acos(cosine);
  const count = cosine < 0 ? 2 : 1;
  const step = -angle / count;
  const handle = 4 / 3 * Math.tan(-step / 4);
  const initial = Math.atan2(start.y, start.x);
  let from = start;

  writer.line(add(center, start));
  for (let i = 1; i <= count; i++) {
    const a = initial + step * i;
    const to = i === count ? end : { x: radius * Math.cos(a), y: radius * Math.sin(a) };

    writer.cubic([add(center, from), add(center, sub(from, mul(normal(from), handle))), add(center, add(to, mul(normal(to), handle))), add(center, to)]);
    from = to;
  }
}

/** Emit the outer wedge between two equal-width segments. */
function expandJoin (writer: StrokeWriter, center: Point, incoming: Point, outgoing: Point, style: StrokeAttributes, radius: number): void {
  const first = normalize(incoming);
  const second = normalize(outgoing);

  if (same(first, second) || same(first, mul(second, -1))) {
    return;
  }
  const leftTurn = cross(first, second) > 0;
  const a = mul(leftTurn ? second : first, leftTurn ? -radius : radius);
  const b = mul(leftTurn ? first : second, leftTurn ? -radius : radius);
  const start = normal(a);
  const end = normal(b);
  const product = dot(a, b);

  writer.move(center);
  if (product + 1e-4 >= radius * radius) {
    const cosine = product / (radius * radius);

    if (cosine !== 0) {
      const slope = Math.sqrt(Math.max(0, 1 - cosine * cosine)) / cosine;

      writer.line(add(center, sub(end, mul(b, slope))));
      writer.line(add(center, end));
    }
  } else if (style.join === spec.LineJoin.Round) {
    if (Math.abs(cross(a, b)) >= 1e-6 && Math.abs(Math.tan(Math.acos(Math.max(-1, Math.min(1, product / (radius * radius)))) / 2)) >= 1e-4) {
      roundJoin(writer, center, start, end, radius);
    }
  } else {
    writer.line(add(center, start));
    if (style.join === spec.LineJoin.Miter && cross(a, b) !== 0) {
      const tip = add(start, mul(a, cross(sub(end, start), b) / cross(a, b)));

      if (dot(tip, tip) < (style.miterLimit * radius) ** 2) {
        writer.line(add(center, tip));
      }
    }
    writer.line(add(center, end));
  }
  writer.close();
}

/** Emit butt/round/square caps as separate closed patches. */
function expandCap (writer: StrokeWriter, center: Point, outward: Point, cap: spec.LineCap, radius: number): void {
  if (cap === spec.LineCap.Butt || radius <= 0) {
    return;
  }
  const direction = normalize(outward, radius);
  const n = normal(direction);
  const start = add(center, n);
  const end = sub(center, n);

  writer.move(start);
  if (cap === spec.LineCap.Round) {
    const middle = add(center, direction);
    const handle = mul(direction, QUARTER_CIRCLE_HANDLE);
    const normalHandle = mul(n, QUARTER_CIRCLE_HANDLE);

    writer.cubic([start, add(start, handle), add(middle, normalHandle), middle]);
    writer.cubic([middle, sub(middle, normalHandle), add(end, handle), end]);
  } else {
    writer.line(add(start, direction));
    writer.line(add(end, direction));
    writer.line(end);
  }
  writer.line(center);
  writer.close();
}

const LENGTH_NODES = [0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664];
const LENGTH_WEIGHTS = [0.5688888888888889, 0.4786286704993665, 0.4786286704993665, 0.2369268850561891, 0.2369268850561891];

/** Arc-length lookup with five-point quadrature within each parameter interval. */
class StrokeSegmentMeasure {
  private readonly lengths = [0];
  readonly length: number;

  constructor (readonly segment: Segment) {
    const count = segment.points.length === 2 ? 1 : 16;

    for (let i = 0; i < count; i++) {
      this.lengths.push(this.lengths[i] + this.integrate(i / count, (i + 1) / count));
    }
    this.length = this.lengths[count];
  }

  velocity (t: number): Point {
    const p = this.segment.points;

    return p.length === 2 ? sub(p[1], p[0]) : derivative(p, t);
  }

  private integrate (start: number, end: number): number {
    const half = (end - start) / 2;
    const middle = (start + end) / 2;
    let sum = 0;

    for (let i = 0; i < LENGTH_NODES.length; i++) {
      const velocity = this.velocity(middle + half * LENGTH_NODES[i]);

      sum += LENGTH_WEIGHTS[i] * Math.hypot(velocity.x, velocity.y);
    }

    return sum * half;
  }

  distance (t: number): number {
    if (t <= 0) { return 0; }
    if (t >= 1) { return this.length; }
    const count = this.lengths.length - 1;
    const index = Math.floor(t * count);

    return this.lengths[index] + this.integrate(index / count, t);
  }

  parameter (fraction: number): number {
    let start = 0, end = 1;
    const target = fraction * this.length;

    for (let i = 0; i < 24; i++) {
      const middle = (start + end) / 2;

      if (this.distance(middle) < target) { start = middle; } else { end = middle; }
    }

    return (start + end) / 2;
  }
}

/** Fit the actual boundary derivative, including the change in width along the curve. */
function fitVariableBoundary (
  writer: StrokeWriter, sample: (t: number) => CurveSample, start: number, end: number, tolerance: number, depth = 0,
): void {
  const first = sample(start), last = sample(end);
  const handle = (end - start) / 3;
  const cubic: Cubic = [first.point, add(first.point, mul(first.velocity, handle)), sub(last.point, mul(last.velocity, handle)), last.point];
  const accurate = [0.25, 0.5, 0.75].every(t => {
    const delta = sub(sample(start + (end - start) * t).point, evaluate(cubic, t));

    return dot(delta, delta) <= tolerance * tolerance;
  });

  if (accurate || depth === 12) {
    writer.cubic(cubic);

    return;
  }
  const middle = (start + end) / 2;

  fitVariableBoundary(writer, sample, start, middle, tolerance, depth + 1);
  fitVariableBoundary(writer, sample, middle, end, tolerance, depth + 1);
}

function expandVariableSegment (
  writer: StrokeWriter, measure: StrokeSegmentMeasure, profile: StrokeWidthProfile, width: number, start: number, end: number,
): void {
  const p = measure.segment.points;
  const tolerance = Math.max(1e-4, Math.min(0.25, width / 64));
  const parameters = [0, ...profile.points.filter(point => point.position > start && point.position < end)
    .map(point => measure.parameter((point.position - start) / (end - start))), 1];
  const boundary = (side: 'ascent' | 'descent') => (t: number): CurveSample => {
    const velocity = measure.velocity(t);
    const speed = Math.hypot(velocity.x, velocity.y);
    const direction = speed > 1e-10 ? mul(velocity, 1 / speed)
      : normalize(t <= 0 || t >= 1 ? tangent(measure.segment, t >= 1) : measure.velocity(Math.min(1, t + 1e-5)));
    const n = normal(direction);
    const position = start + (end - start) * measure.distance(t) / measure.length;
    const sample = profile.sample(position, side);
    const sign = side === 'ascent' ? 1 : -1;
    const radius = sign * width * sample.value;
    const change = sign * width * sample.derivative * (end - start) * speed / measure.length;
    const point = p.length === 2 ? add(p[0], mul(sub(p[1], p[0]), t)) : evaluate(p, t);
    const k = p.length === 2 ? 0 : curvature(p, t);

    return { point: add(point, mul(n, radius)), velocity: add(mul(velocity, 1 - k * radius), mul(n, change)) };
  };

  writer.move(p[0]);
  for (const side of ['ascent', 'descent'] as const) {
    const sample = boundary(side);
    const times = side === 'ascent' ? parameters : [...parameters].reverse();

    writer.line(sample(times[0]).point);
    for (let i = 1; i < times.length; i++) {
      fitVariableBoundary(writer, sample, times[i - 1], times[i], tolerance);
    }
    if (side === 'ascent') { writer.line(p[p.length - 1]); }
  }
  writer.close();
}

function expandVariableJoin (
  writer: StrokeWriter, center: Point, incoming: Point, outgoing: Point, style: StrokeAttributes, before: number, after: number,
): void {
  const first = normalize(incoming), second = normalize(outgoing);

  if (dot(first, second) > 1 - 1e-12 && Math.abs(cross(first, second)) < 1e-12) { return; }
  if (Math.abs(before - after) <= 1e-12 * Math.max(1, before, after)) {
    if (before > 0) { expandJoin(writer, center, incoming, outgoing, style, (before + after) / 2); }

    return;
  }
  const left = cross(first, second) > 0;
  const a = normal(left ? mul(second, -1) : first);
  const b = normal(left ? mul(first, -1) : second);
  const startRadius = left ? after : before, endRadius = left ? before : after;
  const start = mul(a, startRadius), end = mul(b, endRadius);

  writer.move(center);
  writer.line(add(center, start));
  if (style.join === spec.LineJoin.Round) {
    const angle = -Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    const initial = Math.atan2(a.y, a.x);

    fitVariableBoundary(writer, t => {
      const direction = { x: Math.cos(initial + angle * t), y: Math.sin(initial + angle * t) };
      const radius = startRadius + (endRadius - startRadius) * t;

      return { point: add(center, mul(direction, radius)),
        velocity: add(mul(direction, endRadius - startRadius), mul(normal(direction), radius * angle)) };
    }, 0, 1, 0.05);
  } else {
    if (style.join === spec.LineJoin.Miter && cross(first, second) !== 0) {
      const tip = add(start, mul(first, cross(sub(end, start), second) / cross(first, second)));

      if (dot(tip, tip) < (style.miterLimit * Math.max(before, after)) ** 2) { writer.line(add(center, tip)); }
    }
    writer.line(add(center, end));
  }
  writer.close();
}

function expandVariableContour (writer: StrokeWriter, segments: Segment[], closed: boolean, style: StrokeAttributes, profile: StrokeWidthProfile, width: number): void {
  if (profile.points.every(point => point.ascent === 0 && point.descent === 0)) { return; }
  const measures = segments.map(segment => new StrokeSegmentMeasure(segment));
  const total = measures.reduce((sum, measure) => sum + measure.length, 0);

  if (!(total > 0)) { return; }
  let distance = 0;
  const ranges = measures.map(measure => {
    const start = distance / total;

    distance += measure.length;

    return [measure.segment.source?.start ?? start, measure.segment.source?.end ?? distance / total];
  });
  const radius = (position: number, side: 'ascent' | 'descent'): number => profile.sample(position, side).value * width;

  for (let i = 0; i < segments.length; i++) {
    if (measures[i].length > 0) {
      expandVariableSegment(writer, measures[i], profile, width, ranges[i][0], ranges[i][1]);
    }
    if (i > 0 || closed) {
      const previous = (i + segments.length - 1) % segments.length;
      const incoming = tangent(segments[previous], true), outgoing = tangent(segments[i], false);
      const side = cross(incoming, outgoing) > 0 ? 'descent' : 'ascent';

      expandVariableJoin(writer, segments[i].points[0], incoming, outgoing, style, radius(ranges[previous][1], side), radius(ranges[i][0], side));
    }
  }
  if (!closed) {
    for (const atEnd of [false, true]) {
      const index = atEnd ? segments.length - 1 : 0;
      const p = segments[index].points;
      const center = atEnd ? p[p.length - 1] : p[0];
      const direction = normalize(tangent(segments[index], atEnd));
      const position = ranges[index][atEnd ? 1 : 0];
      const ascent = radius(position, 'ascent'), descent = radius(position, 'descent');

      expandCap(writer, add(center, mul(normal(direction), (ascent - descent) / 2)), mul(direction, atEnd ? 1 : -1), style.cap, (ascent + descent) / 2);
    }
  }
}

/**
 * Expand a centered stroke to closed line/cubic patches with adaptive cubic offsets.
 * Run in pixel space so absolute degeneracy thresholds also work in world units.
 * Keep patch winding: callers must fill all patches together using the nonzero rule.
 */
function expandCenteredStrokeContours (contours: readonly StrokeContour[], style: StrokeAttributes, screenScale: number): ContourPathCommand[] {
  const radius = style.width * screenScale * 0.5;
  const writer = new StrokeWriter(screenScale);

  for (const contour of contours) {
    const { segments, closed } = contour;

    if (style.variableWidthPoints?.length) {
      const profile = new StrokeWidthProfile(style.variableWidthPoints, contour.sourceSegmentIds);

      if (!profile.points.every(point => point.ascent === 0.5 && point.descent === 0.5)) {
        expandVariableContour(writer, segments, closed, style, profile, style.width * screenScale);
        continue;
      }
    }
    for (let i = 0; i < segments.length; i++) {
      expandSegment(writer, segments[i], radius);
      if (i > 0 || closed) {
        expandJoin(writer, segments[i].points[0], tangent(segments[(i + segments.length - 1) % segments.length], true), tangent(segments[i], false), style, radius);
      }
    }
    if (!closed) {
      const start = segments[0].points[0];
      const last = segments[segments.length - 1];
      const current = last.points[last.points.length - 1];

      expandCap(writer, start, mul(tangent(segments[0], false), -1), style.cap, radius);
      expandCap(writer, current, tangent(last, true), style.cap, radius);
    }
  }

  return writer.commands;
}

/** Resolve trim mappings before partitioning so filtering contours cannot reindex their sources. */
function partitionStrokePath (path: readonly ContourPathCommand[], scale: number, result?: TrimmedPathResult): StrokeContour[] {
  const contours: StrokeContour[] = [];
  let segments: Segment[] = [];
  let commands: ContourPathCommand[] = [];
  let current: Point = { x: 0, y: 0 };
  let start = current;
  let sourceCurrent = current;
  let sourceStart = current;
  let segmentId = 0;
  let source: TrimContourSource | undefined;
  const finish = (closed: boolean): void => {
    if (segments.length > 0) {
      contours.push({ path: commands, segments, closed, sourceClosed: source?.closed || closed,
        sourceSegmentIds: source?.segmentIds ?? segments.map(segment => segment.segmentId) });
    }
    segments = [];
    commands = [];
    source = undefined;
  };

  for (let index = 0; index < path.length; index++) {
    const command = path[index];
    const points = command.data.map(p => mul(p, scale));

    if (command.action === 'moveTo') {
      finish(false);
      source = result?.contours.get(index);
    }
    commands.push(command);
    const segmentSource = result?.segments.get(index);
    const id = segmentSource?.segmentId ?? segmentId;

    switch (command.action) {
      case 'moveTo':
        current = start = points[0];
        sourceCurrent = sourceStart = command.data[0];

        break;
      case 'lineTo':
        if (!same(current, points[0])) {
          segments.push({ points: [current, points[0]], segmentId: id, source: segmentSource });
        }
        segmentId++;
        current = points[0];
        sourceCurrent = command.data[0];

        break;
      case 'bezierCurveTo':
        if (!points.every(p => same(p, current))) {
          // A cubic with both endpoint handles collapsed represents a straight edge.
          segments.push({ points: same(current, points[0]) && same(points[1], points[2])
            ? [current, points[2]] : [current, points[0], points[1], points[2]], segmentId: id, source: segmentSource });
        }
        segmentId++;
        current = points[2];
        sourceCurrent = command.data[2];

        break;
      case 'closePath':
        if (!same(current, start)) {
          segments.push({ points: [current, start], segmentId: id, source: segmentSource });
        }
        if (sourceCurrent.x !== sourceStart.x || sourceCurrent.y !== sourceStart.y) { segmentId++; }
        current = start;
        sourceCurrent = sourceStart;
        finish(true);

        break;
    }
  }
  finish(false);

  return contours;
}

/**
 * Keep open contours centered; clip aligned strokes against closed source contours only.
 * A separate fill path and trim result retain alignment when a closed path is trimmed.
 */
export function expandStrokePath (
  path: readonly ContourPathCommand[],
  style: StrokeAttributes,
  screenScale = 1,
  fillPath: readonly ContourPathCommand[] = path,
  trimResult?: TrimmedPathResult,
): ContourPathCommand[] {
  const { alignment } = style;

  if (style.width <= 0) {
    return [];
  }
  const contours = partitionStrokePath(path, screenScale, trimResult);
  const alignedContours = contours.filter(contour => contour.sourceClosed);

  if (alignment === 0.5 || alignedContours.length === 0) {
    return expandCenteredStrokeContours(contours, style, screenScale);
  }
  const maskPath = partitionStrokePath(fillPath, screenScale).filter(contour => contour.closed).flatMap(contour => contour.path);

  if (maskPath.length === 0) {
    return expandCenteredStrokeContours(contours, style, screenScale);
  }
  const openContours = contours.filter(contour => !contour.sourceClosed);
  const mask = flattenStrokePath(maskPath, screenScale).map(contour => contour.points);
  const writer = new StrokeWriter(1);

  for (const command of expandCenteredStrokeContours(openContours, style, screenScale)) {
    writer.commands.push(command);
  }
  for (const [fraction, operation] of [[alignment, 'intersect'], [1 - alignment, 'subtract']] as const) {
    if (fraction === 0) {
      continue;
    }
    const expanded = expandCenteredStrokeContours(alignedContours, { ...style, width: style.width * 2 * fraction }, screenScale);
    const contours = flattenStrokePath(expanded, screenScale).map(contour => contour.points);
    const clipped = clipContours(contours, mask, operation, false);

    for (const contour of clipped) {
      writer.move({ x: contour[0], y: contour[1] });
      for (let i = 2; i < contour.length; i += 2) {
        writer.line({ x: contour[i], y: contour[i + 1] });
      }
      writer.close();
    }
  }

  return writer.commands;
}

/** Flatten the expanded boundaries only after offsetting, preserving their winding and holes. */
export function flattenStrokePath (path: readonly ContourPathCommand[], screenScale: number): StrokeOutlineContour[] {
  const contours: StrokeOutlineContour[] = [];
  let points: number[] = [];
  const finish = (): void => {
    if (points.length >= 6) {
      contours.push({ points, closed: true });
    }
    points = [];
  };

  for (const command of path) {
    switch (command.action) {
      case 'moveTo':
        finish();
        points.push(command.data[0].x, command.data[0].y);

        break;
      case 'lineTo': {
        const p = command.data[0];

        if (points[points.length - 2] !== p.x || points[points.length - 1] !== p.y) {
          points.push(p.x, p.y);
        }

        break;
      }
      case 'bezierCurveTo': {
        const [a, b, end] = command.data;

        buildAdaptiveBezier(points, points[points.length - 2], points[points.length - 1], a.x, a.y, b.x, b.y, end.x, end.y, undefined, screenScale);

        break;
      }
      case 'closePath':
        finish();

        break;
    }
  }
  finish();

  return contours;
}
