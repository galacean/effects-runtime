import type { ValueGetter } from '@galacean/effects';
import { BezierCurve, InterpolationMode, WeightedMode, createValueGetter, spec } from '@galacean/effects';
import type { SequenceKey } from './curve-data';
import { decodeCurve, decodeSpatialCurve, encodeCurve, insertBoundary, makeKey } from './curve-data';

/** Editor typing for curve expressions already supported by the runtime's value getters. */
export interface PositionAnimationData extends Omit<spec.PositionOverLifetime, 'path'> {
  path?: spec.FixedVec3Expression | spec.Vector3CurveValue,
}

export interface PositionChannel {
  keys: SequenceKey[],
  defaultValue: number,
  axis: number,
  pathView?: 'point' | 'timing',
}
export interface SpatialKey {
  id: string,
  timing: SequenceKey,
  point: spec.vec3,
  incoming: spec.vec3,
  outgoing: spec.vec3,
}
export interface PositionPathSnapshot {
  original?: spec.FixedVec3Expression,
  pristine: boolean,
  keys: SpatialKey[],
  defaults: spec.vec3,
  range: spec.vec2,
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const lerp = (a: spec.vec3, b: spec.vec3, t: number): spec.vec3 => a.map((value, axis) => value + (b[axis] - value) * t) as spec.vec3;
const distance = (a: spec.vec3, b: spec.vec3) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const timingFields = ['inSlope', 'outSlope', 'inWeight', 'outWeight', 'weightedMode', 'interpolationMode', 'tangentMode'] as const;

function split (points: spec.vec3[], t: number): spec.vec3[] {
  const a = lerp(points[0], points[1], t), b = lerp(points[1], points[2], t), c = lerp(points[2], points[3], t);
  const d = lerp(a, b, t), e = lerp(b, c, t);

  return [a, d, lerp(d, e, t), e, c];
}

/** Invert distance along a spatial cubic, rather than treating distance as its Bezier parameter. */
function parameterAtDistance (points: spec.vec3[], progress: number): number {
  const lengths = [0];
  let previous = points[0];

  for (let index = 1; index <= 512; index++) {
    const point = split(points, index / 512)[2];

    lengths.push(lengths[index - 1] + distance(previous, point)); previous = point;
  }
  const target = Math.max(0, Math.min(1, progress)) * lengths[512];
  const index = Math.max(1, lengths.findIndex(length => length >= target));
  const fraction = (target - lengths[index - 1]) / (lengths[index] - lengths[index - 1] || 1);

  return (index - 1 + fraction) / 512;
}

/** Spatial data is authoritative. Axis keys are linked views, never a baked replacement. */
export class PositionPathModel {
  keys: SpatialKey[] = [];
  range: spec.vec2;
  private original?: spec.FixedVec3Expression;
  private pristine = true;
  private getter?: ValueGetter<any>;
  private timingGetter?: BezierCurve;

  constructor (path: spec.FixedVec3Expression | undefined, readonly defaults: spec.vec3, range: spec.vec2 = [0, 1]) {
    this.original = clone(path); this.range = [...range];
    if (!path) { return; }
    let timing: SequenceKey[], points: spec.vec3[], controls: spec.vec3[];

    if (path[0] === spec.ValueType.CONSTANT_VEC3) {
      timing = [makeKey(0, 0)]; points = [path[1]]; controls = [];
    } else if (path[0] === spec.ValueType.BEZIER_CURVE_PATH) {
      timing = decodeCurve([spec.ValueType.BEZIER_CURVE, path[1][0]]); points = path[1][1]; controls = path[1][2];
    } else if (path[0] === spec.ValueType.LINEAR_PATH) {
      const source = path[1][0];

      points = path[1][1]; controls = [];
      timing = source.map((key, index) => {
        const result = makeKey(key[0], index);
        const before = source[index - 1], after = source[index + 1];

        result.inSlope = before ? (key[1] === before[1] ? 1 / (key[0] - before[0]) : key[2] / (key[1] - before[1])) : 0;
        result.outSlope = after ? (after[1] === key[1] ? 1 / (after[0] - key[0]) : key[3] / (after[1] - key[1])) : 0;
        result.tangentMode = 'user';

        return result;
      });
      for (let index = 0; index + 1 < points.length; index++) {
        controls.push(lerp(points[index], points[index + 1], 1 / 3), lerp(points[index], points[index + 1], 2 / 3));
      }
    } else {
      throw new Error('Unsupported spatial position path.');
    }
    this.keys = timing.map((key, index) => ({ id: key.id, timing: key, point: [...points[index]],
      incoming: [...controls[index * 2 - 1] ?? points[index]], outgoing: [...controls[index * 2] ?? points[index]] }));
  }

  static restore (snapshot: PositionPathSnapshot, freshIds = false): PositionPathModel {
    const data = clone(snapshot);
    const model = new PositionPathModel(undefined, data.defaults, data.range);

    model.original = data.original; model.pristine = data.pristine; model.keys = data.keys;
    if (freshIds) { model.keys.forEach(key => { key.id = key.timing.id = makeKey(0, 0).id; }); }

    return model;
  }

  snapshot (): PositionPathSnapshot {
    return clone({ original: this.original, pristine: this.pristine, keys: this.keys, defaults: this.defaults, range: this.range });
  }

  expression (): spec.FixedVec3Expression | undefined {
    if (this.pristine) { return clone(this.original); }
    if (!this.keys.length) { return; }
    const timing = encodeCurve(this.keys.map(key => key.timing)) as spec.BezierValue;
    const controls = this.keys.slice(0, -1).flatMap((key, index) => [key.outgoing, this.keys[index + 1].incoming]);

    return [spec.ValueType.BEZIER_CURVE_PATH, [timing[1], this.keys.map(key => [...key.point]), clone(controls)]];
  }

  /** Rebase time using the existing path format; retain off-clip keys and all spatial geometry. */
  runtimeExpression (): spec.FixedVec3Expression | undefined {
    const path = this.expression();
    const [start, end] = this.range;

    if (!path || start === 0 && end === 1) { return path; }
    const duration = end - start;

    if (path[0] === spec.ValueType.BEZIER_CURVE_PATH) {
      for (const key of path[1][0]) {
        for (let index = 0; index < key[1].length; index += 2) {
          key[1][index] = (key[1][index] - start) / duration;
        }
      }
    } else if (path[0] === spec.ValueType.LINEAR_PATH) {
      for (const key of path[1][0]) {
        key[0] = (key[0] - start) / duration;
        key[2] *= duration; key[3] *= duration;
      }
    }

    return path;
  }

  evaluate (time: number, axis: number): number {
    const sourceTime = this.range[0] + time * (this.range[1] - this.range[0]);

    if (axis === 3) {
      if (!this.timingGetter) { this.timingGetter = new BezierCurve([]); this.timingGetter.setKeyFrames(this.keys.map(key => key.timing)); }

      return this.timingGetter.getValue(sourceTime);
    }
    if (!this.getter) {
      const expression = this.expression();

      this.getter = createValueGetter(expression ?? [spec.ValueType.CONSTANT_VEC3, this.defaults]);
    }
    const point = this.getter.getValue(sourceTime);

    return Array.isArray(point) ? point[axis] : point[['x', 'y', 'z'][axis]];
  }

  project (channels: PositionChannel[]): void {
    const duration = this.range[1] - this.range[0];

    for (const channel of channels) {
      const previous = new Map(channel.keys.map(key => [key.id, key]));

      channel.keys = this.keys.filter(key => key.timing.time >= this.range[0] - 1e-8 && key.timing.time <= this.range[1] + 1e-8).map(key => {
        const id = key.id + ':' + channel.axis;
        const projected = previous.get(id) ?? makeKey(0, 0);
        const time = (key.timing.time - this.range[0]) / duration;

        Object.assign(projected, channel.pathView === 'timing' ? key.timing : makeKey(time, key.point[channel.axis]), {
          id, pathKeyId: key.id, time, tangentMode: channel.pathView === 'timing' ? key.timing.tangentMode : 'user',
        });
        if (channel.pathView === 'timing') { projected.inSlope *= duration; projected.outSlope *= duration; } else { projected.interpolationMode = key.timing.interpolationMode; }

        return projected;
      });
    }
  }

  /** Apply edits from linked views once, keeping time and deletion shared by XYZ. */
  update (channels: PositionChannel[]): void {
    const duration = this.range[1] - this.range[0];
    let changed = false;

    for (const key of this.keys) {
      const views = channels.flatMap(channel => channel.keys.filter(view => view.pathKeyId === key.id).map(view => ({ channel, view })));
      const time = (key.timing.time - this.range[0]) / duration;
      const moved = views.find(({ view }) => Math.abs(view.time - time) > 1e-9);

      if (moved) { key.timing.time = this.range[0] + moved.view.time * duration; changed = true; }
      for (const { channel, view } of views) {
        if (channel.pathView === 'point') {
          const delta = view.value - key.point[channel.axis];

          if (delta !== 0) {
            for (const point of [key.point, key.incoming, key.outgoing]) { point[channel.axis] += delta; }
            changed = true;
          }
        } else {
          for (const field of timingFields) {
            const value = field === 'inSlope' || field === 'outSlope' ? view[field] / duration : view[field];

            const previous = key.timing[field];

            if (typeof previous === 'number' && typeof value === 'number' ? Math.abs(previous - value) > 1e-10 : previous !== value) {
              Object.assign(key.timing, { [field]: value }); changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      this.keys.sort((a, b) => a.timing.time - b.timing.time);
      for (let index = 1; index < this.keys.length; index++) {
        this.keys[index].timing.time = Math.max(this.keys[index].timing.time, this.keys[index - 1].timing.time + 1e-7);
      }
      this.invalidate();
    }
    this.project(channels);
  }

  insert (time: number, point?: spec.vec3): SpatialKey {
    const sourceTime = this.range[0] + time * (this.range[1] - this.range[0]);
    const existing = this.keys.find(key => Math.abs(key.timing.time - sourceTime) < 1e-8);

    if (existing) {
      if (point) { this.movePoint(existing, point); }

      return existing;
    }
    const index = this.keys.findIndex(key => key.timing.time > sourceTime);
    const timing = this.keys.map(key => key.timing);
    let position = [this.evaluate(time, 0), this.evaluate(time, 1), this.evaluate(time, 2)] as spec.vec3;
    let incoming = [...position] as spec.vec3, outgoing = [...position] as spec.vec3;

    if (index > 0) {
      const left = this.keys[index - 1], right = this.keys[index];
      const value = this.evaluate(time, 3);
      const progress = (value - left.timing.value) / (right.timing.value - left.timing.value || 1);
      const pieces = split([left.point, left.outgoing, right.incoming, right.point],
        parameterAtDistance([left.point, left.outgoing, right.incoming, right.point], progress));

      left.outgoing = pieces[0]; incoming = pieces[1]; position = pieces[2]; outgoing = pieces[3]; right.incoming = pieces[4];
    }
    if (timing.length) { insertBoundary(timing, sourceTime); } else { timing.push(makeKey(sourceTime, 0)); }
    const inserted = timing.find(key => Math.abs(key.time - sourceTime) < 1e-8)!;

    if (index === 0) { inserted.value = this.keys[0].timing.value - 1; }
    if (index === -1 && this.keys.length) { inserted.value = this.keys.at(-1)!.timing.value + 1; }
    const key: SpatialKey = { id: inserted.id, timing: inserted, point: position, incoming, outgoing };

    this.keys.splice(index < 0 ? this.keys.length : index, 0, key);
    this.invalidate();
    if (point) { this.movePoint(key, point); }

    return key;
  }

  duplicate (id: string): SpatialKey | undefined {
    const index = this.keys.findIndex(key => key.id === id);

    if (index < 0) { return; }
    const key = clone(this.keys[index]);

    key.id = key.timing.id = makeKey(0, 0).id;
    this.keys.splice(index + 1, 0, key); this.invalidate();

    return key;
  }

  remove (ids: Set<string>): void {
    if (!this.keys.some(key => ids.has(key.id))) { return; }
    this.keys = this.keys.filter(key => !ids.has(key.id)); this.invalidate();
  }

  movePoint (key: SpatialKey, point: spec.vec3): void {
    const offset = point.map((value, axis) => value - key.point[axis]);

    if (offset.every(value => value === 0)) { return; }
    for (const control of [key.point, key.incoming, key.outgoing]) { control.forEach((_, axis) => control[axis] += offset[axis]); }
    this.invalidate();
  }

  setControl (id: string, side: 'incoming' | 'outgoing', point: spec.vec3): void {
    const key = this.keys.find(key => key.id === id);

    if (key) { key[side] = [...point]; this.invalidate(); }
  }

  trim (from: number, to: number): void {
    const [start, end] = this.range;

    this.range = [start + from * (end - start), start + to * (end - start)];
  }

  separate (): SequenceKey[][] {
    if (!this.keys.length) { return [[], [], []]; }
    if (this.keys.length === 1) { return [0, 1, 2].map(axis => [makeKey(0, this.keys[0].point[axis])]); }
    const model = PositionPathModel.restore(this.snapshot());

    model.insert(0); model.insert(1);
    const visible = model.keys.filter(key => key.timing.time >= model.range[0] - 1e-8 && key.timing.time <= model.range[1] + 1e-8);
    const duration = model.range[1] - model.range[0];
    const straight = visible.slice(0, -1).every((key, index) => {
      const right = visible[index + 1], length = distance(key.point, right.point);

      return [key.outgoing, right.incoming].every(control => {
        const progress = length ? control.reduce((sum, value, axis) => sum + (value - key.point[axis]) * (right.point[axis] - key.point[axis]), 0) / (length * length) : 0;

        return progress >= -1e-8 && progress <= 1 + 1e-8 && distance(control, lerp(key.point, right.point, progress)) < 1e-7;
      }) && (length < 1e-8 || distance(key.point, key.outgoing) <= distance(key.point, right.incoming) + 1e-8);
    });
    const knots = visible.map(key => (key.timing.time - model.range[0]) / duration);
    const holds = new Set(visible.filter(key => key.timing.interpolationMode === InterpolationMode.Constant)
      .map(key => (key.timing.time - model.range[0]) / duration));
    const channels = [0, 1, 2].map(axis => {
      if (!straight) { return decodeSpatialCurve(time => this.evaluate(time, axis), knots, holds); }

      return visible.map((key, index) => {
        const previous = visible[index - 1], next = visible[index + 1];
        const result: SequenceKey = { ...key.timing, id: makeKey(0, 0).id, time: (key.timing.time - model.range[0]) / duration,
          value: key.point[axis], tangentMode: 'break', weightedMode: WeightedMode.Both };

        result.inSlope *= duration * (previous ? (key.point[axis] - previous.point[axis]) / (key.timing.value - previous.timing.value || 1) : 0);
        result.outSlope *= duration * (next ? (next.point[axis] - key.point[axis]) / (next.timing.value - key.timing.value || 1) : 0);

        return result;
      });
    });

    for (let axis = 0; axis < 3; axis++) {
      const valid = () => {
        const curve = createValueGetter(encodeCurve(channels[axis]));
        const times = Array.from(new Set([0, ...channels[axis].map(key => key.time), 1])).sort((a, b) => a - b);

        for (let index = 0; index + 1 < times.length; index++) {
          for (let sample = 0; sample <= 32; sample++) {
            const time = times[index] + (times[index + 1] - times[index]) * sample / 32;
            const error = Math.abs(curve.getValue(time) - this.evaluate(time, axis));

            if (!Number.isFinite(error) || error > 0.003) { return false; }
          }
        }

        return true;
      };

      if (!valid()) {
        if (straight) { channels[axis] = decodeSpatialCurve(value => this.evaluate(value, axis), knots, holds); }
        if (!valid()) { throw new Error('Separating this position path would exceed the allowed animation error.'); }
      }
    }

    return channels;
  }

  private invalidate (): void { this.pristine = false; this.getter = undefined; this.timingGetter = undefined; }
}

/** Independent axes remain independent in exported runtime data. */
export function encodePositionAxes (channels: PositionChannel[]): spec.Vector3CurveValue | undefined {
  if (!channels.some(channel => channel.keys.length)) { return; }

  return [spec.ValueType.VECTOR3_CURVE, channels.map(channel => encodeCurve(channel.keys.length ? channel.keys :
    [makeKey(0, channel.defaultValue)])) as spec.Vector3CurveData];
}
