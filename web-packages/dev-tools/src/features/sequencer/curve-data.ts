import type { Keyframe } from '@galacean/effects';
import { BezierCurve, InterpolationMode, WeightedMode, createValueGetter, spec } from '@galacean/effects';

export type TangentMode = 'auto' | 'user' | 'break';
export interface SequenceKey extends Keyframe {
  id: string,
  tangentMode: TangentMode,
}
let keySerial = 0;

/** Identify the runtime curve without duplicating baked path data in editor storage. */
export function curveSourceSignature (value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  let first = 2166136261, second = 5381;

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);

    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }

  return text.length + ':' + (first >>> 0).toString(16) + ':' + (second >>> 0).toString(16);
}

export function makeKey (time: number, value: number): SequenceKey {
  return { id: 'key-' + ++keySerial, time, value, inSlope: 0, outSlope: 0, inWeight: 1, outWeight: 1,
    weightedMode: WeightedMode.Both, interpolationMode: InterpolationMode.Cubic, tangentMode: 'auto' };
}

export function decodeCurve (expression: spec.FixedNumberExpression | undefined, fallback = 0): SequenceKey[] {
  if (expression === undefined) { return []; }
  const curve = createValueGetter(expression);

  if (curve instanceof BezierCurve) {
    return curve.getKeyFrames().map(key => ({ ...key, id: 'key-' + ++keySerial, tangentMode: 'user' }));
  }
  if (Array.isArray(expression) && expression[0] === spec.ValueType.LINE) {
    return (expression[1] as number[][]).map(pair => ({ ...makeKey(pair[0], pair[1]), interpolationMode: InterpolationMode.Linear }));
  }
  const value = curve.getValue(0);

  return [makeKey(0, typeof value === 'number' ? value : fallback)];
}

export function updateAutoTangents (keys: SequenceKey[]): void {
  keys.sort((a, b) => a.time - b.time);
  keys.forEach((key, index) => {
    if (key.tangentMode !== 'auto') { return; }
    const left = keys[Math.max(0, index - 1)];
    const right = keys[Math.min(keys.length - 1, index + 1)];
    let slope = (right.value - left.value) / Math.max(1e-8, right.time - left.time);

    if (index > 0 && index + 1 < keys.length && (key.value - left.value) * (right.value - key.value) <= 0) { slope = 0; }
    key.inSlope = key.outSlope = slope;
    key.inWeight = key.outWeight = 1;
  });
}

export function controlPoint (keys: SequenceKey[], index: number, side: 'in' | 'out'): { time: number, value: number } {
  const key = keys[index];
  const neighbor = keys[index + (side === 'in' ? -1 : 1)];
  const interval = Math.abs((neighbor?.time ?? key.time + (side === 'in' ? -0.2 : 0.2)) - key.time);
  const dx = interval / 3 * (side === 'in' ? -key.inWeight : key.outWeight);

  return { time: key.time + dx, value: key.value + dx * (side === 'in' ? key.inSlope : key.outSlope) };
}

export function encodeCurve (keys: SequenceKey[]): spec.FixedNumberExpression {
  if (!keys.length) { return [spec.ValueType.CONSTANT, 0]; }
  const data = keys.map((key, index) => {
    const incoming = index > 0 && keys[index - 1].interpolationMode === InterpolationMode.Cubic;
    const outgoing = key.interpolationMode === InterpolationMode.Cubic;
    const point = [key.time, key.value];
    const left = controlPoint(keys, index, 'in');
    const right = controlPoint(keys, index, 'out');

    if (key.interpolationMode === InterpolationMode.Constant) {
      return incoming
        ? [spec.BezierKeyframeType.HOLD, [left.time, left.value, ...point], spec.BezierKeyframeType.EASE_IN]
        : [spec.BezierKeyframeType.HOLD, point, spec.BezierKeyframeType.LINE];
    }
    if (incoming && outgoing) { return [spec.BezierKeyframeType.EASE, [left.time, left.value, ...point, right.time, right.value]]; }
    if (incoming) { return [spec.BezierKeyframeType.EASE_IN, [left.time, left.value, ...point]]; }
    if (outgoing) { return [spec.BezierKeyframeType.EASE_OUT, [...point, right.time, right.value]]; }

    return [spec.BezierKeyframeType.LINE, point];
  });

  return [spec.ValueType.BEZIER_CURVE, data] as spec.FixedNumberExpression;
}

export function sampleCurve (keys: SequenceKey[], time: number): number {
  if (!keys.length) { return 0; }
  const curve = new BezierCurve([]);

  curve.setKeyFrames(keys);

  return curve.getValue(time);
}

/** Insert a boundary while preserving both halves of a cubic segment. */
export function insertBoundary (keys: SequenceKey[], time: number): void {
  if (keys.some(key => Math.abs(key.time - time) < 1e-8)) { return; }
  const index = keys.findIndex(key => key.time > time);
  const key = makeKey(time, sampleCurve(keys, time));

  key.tangentMode = 'break';
  if (index <= 0) {
    if (index === 0) { key.interpolationMode = InterpolationMode.Constant; } else if (keys.length) {
      keys[keys.length - 1].interpolationMode = InterpolationMode.Constant;
    }
    keys.splice(index === 0 ? 0 : keys.length, 0, key);

    return;
  }
  const left = keys[index - 1];
  const right = keys[index];

  key.interpolationMode = left.interpolationMode;
  if (left.interpolationMode === InterpolationMode.Cubic) {
    const p0 = { time: left.time, value: left.value };
    const p1 = controlPoint(keys, index - 1, 'out');
    const p2 = controlPoint(keys, index, 'in');
    const p3 = { time: right.time, value: right.value };
    const lerp = (a: typeof p0, b: typeof p0, t: number) => ({ time: a.time + (b.time - a.time) * t, value: a.value + (b.value - a.value) * t });
    let low = 0, high = 1;

    for (let i = 0; i < 35; i++) {
      const t = (low + high) / 2;
      const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);

      if (lerp(lerp(a, b, t), lerp(b, c, t), t).time < time) { low = t; } else { high = t; }
    }
    const t = (low + high) / 2;
    const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
    const d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);

    key.value = f.value;
    const set = (target: SequenceKey, side: 'in' | 'out', point: typeof p0, interval: number) => {
      const dx = point.time - target.time;

      target[side === 'in' ? 'inSlope' : 'outSlope'] = Math.abs(dx) < 1e-9 ? 0 : (point.value - target.value) / dx;
      target[side === 'in' ? 'inWeight' : 'outWeight'] = Math.abs(dx) * 3 / Math.max(interval, 1e-9);
      target.tangentMode = 'break';
    };

    set(left, 'out', a, time - left.time);
    set(key, 'in', d, time - left.time);
    set(key, 'out', e, right.time - time);
    set(right, 'in', c, right.time - time);
  }
  keys.splice(index, 0, key);
}

/** Trimming preserves absolute animation time; stretching keeps normalized keys. */
export function trimKeys (source: SequenceKey[], from: number, to: number): SequenceKey[] {
  const keys = source.map(key => ({ ...key }));

  if (!keys.length) { return keys; }
  insertBoundary(keys, from);
  insertBoundary(keys, to);
  const range = Math.max(1e-8, to - from);

  return keys.filter(key => key.time >= from - 1e-8 && key.time <= to + 1e-8).map(key => ({
    ...key, time: (key.time - from) / range, inSlope: key.inSlope * range, outSlope: key.outSlope * range,
    tangentMode: 'break',
  }));
}

/** Convert a spatial projection only when needed, keeping its authored knots and bounded sampling error. */
export function decodeSpatialCurve (sample: (time: number) => number, knots: number[]): SequenceKey[] {
  const times = Array.from(new Set([0, ...knots.filter(time => time > 0 && time < 1), 1])).sort((a, b) => a - b);
  const result: SequenceKey[] = [];
  const derivative = (time: number, from: number, to: number) => {
    const epsilon = Math.min(1e-4, (to - from) / 100);
    const left = Math.max(from, time - epsilon), right = Math.min(to, time + epsilon);

    return (sample(right) - sample(left)) / Math.max(1e-10, right - left);
  };
  const subdivide = (from: number, to: number, depth: number) => {
    const left = makeKey(from, sample(from)), right = makeKey(to, sample(to));

    left.tangentMode = right.tangentMode = 'break';
    left.outSlope = derivative(from, from, to);
    right.inSlope = derivative(to, from, to);
    const curve = new BezierCurve([]);

    curve.setKeyFrames([left, right]);
    const tolerance = 1e-4 * Math.max(1, Math.abs(left.value), Math.abs(right.value));
    const error = Math.max(...[0.25, 0.5, 0.75].map(ratio => {
      const time = from + (to - from) * ratio;

      return Math.abs(curve.getValue(time) - sample(time));
    }));

    if (error > tolerance && depth < 8 && result.length < 512) {
      const middle = (from + to) / 2;

      subdivide(from, middle, depth + 1); subdivide(middle, to, depth + 1);
    } else {
      if (result.length) { result[result.length - 1].outSlope = left.outSlope; } else { result.push(left); }
      result.push(right);
    }
  };

  for (let index = 0; index + 1 < times.length; index++) { subdivide(times[index], times[index + 1], 0); }
  if (result.every(key => Math.abs(key.value - result[0].value) < 1e-8)) { return [makeKey(0, result[0].value)]; }

  return result;
}
