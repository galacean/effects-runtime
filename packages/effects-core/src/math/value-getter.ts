import * as spec from '@galacean/effects-specification';
import { isArray, random, colorToArr, colorStopsFromGradient, interpolateColor, isFunction } from '../utils';
import type { ColorStop } from '../utils';
import { Float16ArrayWrapper } from './float16array-wrapper';

interface KeyFrameMeta {
  curves: ValueGetter<any>[],
  index: number,
  max: number,
  lineSegCount: number,
  curveCount: number,
}

const NOT_IMPLEMENT = 'not_implement';

export class ValueGetter<T> {
  constructor (arg: any) {
    this.onCreate(arg);
  }

  onCreate (props: any) {
    throw Error(NOT_IMPLEMENT);
  }

  getIntegrateValue (t0: number, t1: number, timeScale = 1): T {
    throw Error(NOT_IMPLEMENT);
  }

  getIntegrateByTime (t0: number, time: number): T {
    throw Error(NOT_IMPLEMENT);
  }

  getValue (time?: number): T {
    throw Error(NOT_IMPLEMENT);
  }

  toUniform (meta: KeyFrameMeta): Float32Array {
    throw Error(NOT_IMPLEMENT);
  }

  map (func: (n: T) => T) {
    throw Error(NOT_IMPLEMENT);
  }

  scaleXCoord (scale: number): ValueGetter<T> {
    return this;
  }
}

export class StaticValue extends ValueGetter<number> {
  private value: number;

  override onCreate (arg: number) {
    this.value = arg;
  }

  override getIntegrateValue (t0: number, t1: number, ts: number) {
    return this.value * (t1 - t0);
  }

  override getIntegrateByTime (t0: number, t1: number) {
    return 0.5 * this.value * (t1 * t1 - t0 * t0);
  }

  override getValue (time?: number): number {
    return this.value;
  }

  override toUniform () {
    return new Float32Array([0, this.value, 0, 0]);
  }

  override map (func: (n: number) => number) {
    const val = this.value;

    this.value = func(val);

    return this;
  }
}

export class RandomSetValue<T> extends ValueGetter<T> {
  private items: T[];

  override onCreate (arg: T[]) {
    this.items = arg;
  }

  override getValue (t: number): T {
    const items = this.items;

    return items[Math.floor(Math.random() * items.length)];
  }

  override map (func: (v: T) => T) {
    this.items = this.items.map(func);

    return this;
  }
}

export class RandomValue extends ValueGetter<number> {
  private min: number;
  private max: number;

  override onCreate (props: [min: number, max: number]) {
    this.min = props[0];
    this.max = props[1];
  }

  override getValue (time?: number): number {
    return random(this.min, this.max);
  }

  override toUniform () {
    return new Float32Array([4, this.min, this.max, 0]);
  }

  override map (func: any) {
    this.min = func(this.min);
    this.max = func(this.max);

    return this;
  }
}

export class RandomVectorValue extends ValueGetter<number[]> {
  private min: number[];
  private max: number[];

  override onCreate (props: [min: number[], max: number[]]) {
    this.min = props[0];
    this.max = props[1];
  }

  override getValue (time: number): number[] {
    const min = this.min;
    const max = this.max;
    const ret = [];

    for (let i = 0; i < min.length; i++) {
      const t = Math.random();

      ret[i] = min[i] * (1 - t) + max[i] * t;
    }

    return ret;
  }

  // TODO:
  override map (func: any) {
    this.min = this.min.map(func);
    this.max = this.max.map(func);

    return this;
  }
}

export class LinearValue extends ValueGetter<number> {
  private min: number;
  private max: number;
  private xCoord: number;

  override onCreate (props: [min: number, max: number]) {
    this.min = props[0];
    this.max = props[1];
    this.xCoord = 1;
  }

  override getValue (t: number) {
    t /= this.xCoord;

    return this.min * (1 - t) + this.max * t;
  }

  override toUniform () {
    return new Float32Array([1, this.min, this.max, this.xCoord]);
  }

  override getIntegrateValue (t0: number, t1: number, timeScale = 1) {
    const min = this.min;
    const max = this.max;
    const ts = this.xCoord * timeScale;
    const v1 = min + (max - min) * (t1 / ts);
    const v0 = min + (max - min) * (t0 / ts);

    return ((v1 + min) * t1 - (v0 + min) * t0) / 2;
  }

  override getIntegrateByTime (t0: number, t1: number) {
    return lineSegIntegrateByTime(t1, 0, this.xCoord, this.min, this.max) - lineSegIntegrateByTime(t0, 0, this.xCoord, this.min, this.max);
  }

  override map (func: (num: number) => number) {
    this.min = func(this.min);
    this.max = func(this.max);

    return this;
  }

  override scaleXCoord (scale: number): LinearValue {
    this.xCoord = scale;

    return this;
  }
}

export class GradientValue extends ValueGetter<number[]> {

  stops: ColorStop[];

  override onCreate (props: number[][] | Record<string, string>) {
    this.stops = colorStopsFromGradient(props);
  }

  getStops () {
    return this.stops;
  }

  override getValue (time: number) {
    const stops = this.stops;
    const last = stops.length - 1;

    for (let i = 0; i < last; i++) {
      const a = stops[i];
      const b = stops[i + 1];

      if (a.stop <= time && b.stop > time) {
        const t = (time - a.stop) / (b.stop - a.stop);

        return interpolateColor(a.color, b.color, t, true);
      }
    }

    return stops[last].color.slice();
  }
}

export type KeyFrame = {
  inTangent: number,
  outTangent: number,
  time: number,
  value: number,
};

const CURVE_PRO_TIME = 0;
const CURVE_PRO_VALUE = 1;
const CURVE_PRO_IN_TANGENT = 2;
const CURVE_PRO_OUT_TANGENT = 3;

export class CurveValue extends ValueGetter<number> {
  keys: KeyFrame[] | number[][];

  min: number;
  dist: number;
  isCurveValue: boolean;

  static getAllData (meta: KeyFrameMeta, halfFloat?: boolean): Uint16Array | Float32Array {
    const ret = new (halfFloat ? Float16ArrayWrapper : Float32Array)(meta.index * 4);

    for (let i = 0, cursor = 0, curves = meta.curves; i < curves.length; i++) {
      const data = (curves[i] as CurveValue).toData();

      ret.set(data, cursor);
      cursor += data.length;
    }

    return halfFloat ? (ret as Float16ArrayWrapper).data : (ret as Float32Array);
  }

  override onCreate (props: number[] & number[][]) {
    let min = Infinity;
    let max = -Infinity;

    //formatted number
    if (Number.isFinite(props[0]) && Number.isFinite(props[1])) {
      const keys: number[][] = [];

      for (let i = 2; i < props.length; i++) {
        // FIXME
        keys.push(props[i].slice(0, 4));
      }
      this.keys = keys;
      this.min = props[0];
      this.dist = props[1] - props[0];
    } else {
      const keys = (props as number[][]).map(item => {
        if (isArray(item)) {
          min = Math.min(min, item[1]);
          max = Math.max(max, item[1]);

          return item.slice(0, 4);
        } else if (typeof item === 'object' && item) {
          const { time, value, inTangent = 0, outTangent = 0 } = item as KeyFrame;

          min = Math.min(min, value);
          max = Math.max(max, value);

          return [time, value, inTangent, outTangent];
        }
        throw new Error('invalid keyframe');
      });
      const dist = max - min;

      this.keys = keys;

      if (dist !== 0) {
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];

          key[1] = (key[1] - min) / dist;
        }
      }
      const key0 = keys[0];

      if (key0[0] > 0) {
        key0[2] = 0;
        keys.unshift([0, key0[1], 0, 0]);
      }
      const key1 = keys[keys.length - 1];

      if (key1[0] < 1) {
        key1[3] = 0;
        keys.push([1, key1[1], 0, 0]);
      }
      this.min = min;
      this.dist = dist;
    }

    this.isCurveValue = true;
  }

  override getValue (time: number): number {
    const { keys, min, dist } = this;
    const keysNumerArray = keys as number[][];

    if (time <= keysNumerArray[0][CURVE_PRO_TIME]) {
      return keysNumerArray[0][CURVE_PRO_VALUE] * dist + min;
    }

    const end = keysNumerArray.length - 1;

    for (let i = 0; i < end; i++) {
      const key = keysNumerArray[i];
      const k2 = keysNumerArray[i + 1];

      if (time > key[CURVE_PRO_TIME] && time <= k2[CURVE_PRO_TIME]) {
        return curveValueEvaluate(time, key, k2) * dist + min;
      }
    }

    return keysNumerArray[end][CURVE_PRO_VALUE] * dist + min;
  }

  override getIntegrateByTime (t0: number, t1: number) {
    const d = this.integrate(t1, true) - this.integrate(t0, true);

    return this.min * 0.5 * (t1 - t0) * (t1 - t0) + d * this.dist;
  }

  override getIntegrateValue (t0: number, t1: number, ts: number) {
    ts = ts || 1;
    const d = (this.integrate(t1 / ts, false) - this.integrate(t0 / ts, false)) * ts;
    const dt = (t1 - t0) / ts;

    return this.min * dt + d * this.dist;
  }

  integrate (time: number, byTime: boolean) {
    const keys = this.keys as number[][];

    if (time <= keys[0][CURVE_PRO_TIME]) {
      return 0;
    }

    let ret = 0;
    const end = keys.length - 1;
    const func = byTime ? curveValueIntegrateByTime : curveValueIntegrate;

    for (let i = 0; i < end; i++) {
      const key = keys[i];
      const k2 = keys[i + 1];
      const t1 = key[CURVE_PRO_TIME];
      const t2 = k2[CURVE_PRO_TIME];

      if (time > t1 && time <= t2) {
        return ret + func(time, key, k2);
      } else {
        ret += func(t2, key, k2);
      }
    }

    return ret;
  }

  toData (): Float32Array {
    const keys = this.keys as number[][];
    const data = new Float32Array(keys.length * 4);

    for (let i = 0, cursor = 0; i < keys.length; i++, cursor += 4) {
      data.set(keys[i], cursor);
    }

    return data;
  }

  override toUniform (meta: any) {
    const index = meta.index;
    const keys = this.keys;

    meta.curves.push(this);
    meta.index += keys.length;
    meta.max = Math.max(meta.max, keys.length);
    meta.curveCount += keys.length;

    return new Float32Array([2, index + 1 / keys.length, this.min, this.dist]);
  }

  override map (func: (num: number) => number) {
    (this.keys as number[][]).forEach(k => {
      k[CURVE_PRO_VALUE] = func(k[CURVE_PRO_VALUE]);
    });

    return this;
  }

  override scaleXCoord (scale: number) {
    (this.keys as number[][]).forEach(k => k[CURVE_PRO_TIME] = scale * k[CURVE_PRO_TIME]);

    return this;
  }

}

export class LineSegments extends ValueGetter<number> {
  isLineSeg: boolean;

  keys: number[][];

  override onCreate (props: ({ time: number, value: number } & number[])[]) {
    this.keys = props
      .map(p => {
        if (p.slice) {
          return p.slice(0, 2);
        }

        return [p.time, p.value];
      })
      .sort((a, b) => a[0] - b[0]);

    const last = this.keys[this.keys.length - 1];

    if (last[0] < 1) {
      this.keys.push([1, last[1]]);
    }
    const first = this.keys[0];

    if (first[0] > 0) {
      this.keys.unshift([0, first[1]]);
    }
    this.isLineSeg = true;
  }

  override getValue (time: number): number {
    const keys = this.keys;

    if (time < keys[0][0]) {
      return keys[0][1];
    }
    const end = keys.length - 1;

    for (let i = 0; i < end; i++) {
      const key = keys[i];
      const k2 = keys[i + 1];
      const x0 = key[0];
      const x1 = k2[0];

      if (time >= x0 && time <= x1) {
        const p = (time - x0) / (x1 - x0);
        const y0 = key[1];

        return y0 + p * (k2[1] - y0);
      }
    }

    return keys[end][1];
  }

  override getIntegrateValue (t0: number, t1: number, ts = 1) {
    return (this.integrate(t1, false) - this.integrate(t0, false)) * ts;
  }

  override getIntegrateByTime (t0: number, t1: number) {
    return this.integrate(t1, true) - this.integrate(t0, true);
  }

  private integrate (time: number, byTime: boolean): number {
    const keys = this.keys;

    if (time <= keys[0][0]) {
      return 0;
    }

    let ret = 0;
    const end = keys.length - 1;
    const func = byTime ? lineSegIntegrateByTime : lineSegIntegrate;

    for (let i = 0; i < end; i++) {
      const k1 = keys[i];
      const k2 = keys[i + 1];
      const t0 = k1[0];
      const t1 = k2[0];

      if (time > t0 && time <= t1) {
        return ret + func(time, t0, t1, k1[1], k2[1]);
      } else {
        ret += func(t1, t0, t1, k1[1], k2[1]);
      }
    }

    return ret;
  }

  toData () {
    const keys = this.keys;
    const data = new Float32Array(Math.ceil(keys.length / 2) * 4);

    for (let i = 0, cursor = 0; i < keys.length; i++, cursor += 2) {
      data.set(keys[i], cursor);
    }
    data.set(keys[keys.length - 1], data.length - 2);

    return data;
  }

  override toUniform (meta: any) {
    const index = meta.index;
    const keys = this.keys;
    const uniformCount = Math.ceil(keys.length / 2);

    meta.lineSegCount += uniformCount;
    meta.curves.push(this);
    meta.index += uniformCount;
    meta.max = Math.max(meta.max, uniformCount);

    return new Float32Array([3, index, uniformCount, 0]);
  }

  override map (func: (k: number) => number) {
    this.keys.forEach(k => k[1] = func(k[1]));

    return this;
  }

  override scaleXCoord (scale: number) {
    this.keys.forEach(k => k[0] = scale * k[0]);

    return this;
  }
}

export class PathSegments extends ValueGetter<number[]> {
  keys: number[][];
  values: number[][];

  override onCreate (props: number[][][]) {
    this.keys = props[0];
    this.values = props[1];
  }

  override getValue (time: number) {
    const keys = this.keys;
    const values = this.values;

    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i];
      const k1 = keys[i + 1];

      if (k0[0] <= time && k1[0] >= time) {
        const dis = k1[1] - k0[1];
        let dt;

        if (dis === 0) {
          dt = (time - k0[0]) / (k1[0] - k0[0]);
        } else {
          const val = curveValueEvaluate(time, k0, k1);

          dt = (val - k0[1]) / dis;
        }

        return this.calculateVec(i, dt);
      }
    }
    if (time <= keys[0][0]) {
      return values[0].slice();
    }

    return values[values.length - 1].slice();
  }

  calculateVec (i: number, dt: number) {
    const vec0 = this.values[i];
    const vec1 = this.values[i + 1];
    const ret = [0, 0, 0];

    for (let j = 0; j < vec0.length; j++) {
      ret[j] = vec0[j] * (1 - dt) + vec1[j] * dt;
    }

    return ret;
  }
}

export class BezierSegments extends PathSegments {

  cps: number[][];

  override onCreate (props: number[][][]) {
    super.onCreate(props);
    this.cps = props[2];
  }

  override calculateVec (i: number, t: number) {
    const vec0 = this.values[i];
    const vec1 = this.values[i + 1];
    const outCp = this.cps[i + i];
    const inCp = this.cps[i + i + 1];
    const ret = [0, 0, 0];
    const ddt = 1 - t;
    const a = ddt * ddt * ddt;
    const b = 3 * t * ddt * ddt;
    const c = 3 * t * t * ddt;
    const d = t * t * t;

    for (let j = 0; j < vec0.length; j++) {
      ret[j] = a * vec0[j] + b * outCp[j] + c * inCp[j] + d * vec1[j];
    }

    return ret;
  }
}

const map: Record<any, any> = {
  [spec.ValueType.RANDOM] (props: number[][]) {
    if (props[0] instanceof Array) {
      return new RandomVectorValue(props);
    }

    return new RandomValue(props);
  },
  [spec.ValueType.CONSTANT] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC2] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC3] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC4] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CURVE] (props: number[] & number[][]) {
    return new CurveValue(props);
  },
  [spec.ValueType.RGBA_COLOR] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.COLORS] (props: number[][]) {
    return new RandomSetValue(props.map(c => colorToArr(c, false)));
  },
  [spec.ValueType.LINE] (props: number[][]) {
    if (props.length === 2 && props[0][0] === 0 && props[1][0] === 1) {
      return new LinearValue([props[0][1], props[1][1]]);
    }

    return new LineSegments(props);
  },
  [spec.ValueType.GRADIENT_COLOR] (props: number[][] | Record<string, string>) {
    return new GradientValue(props);
  },
  [spec.ValueType.LINEAR_PATH] (pros: number[][][]) {
    return new PathSegments(pros);
  },
  [spec.ValueType.BEZIER_PATH] (pros: number[][][]) {
    return new BezierSegments(pros);
  },
};

export function createValueGetter (args: any): ValueGetter<any> {
  if (!args || !isNaN(+args)) {
    return new StaticValue(args || 0);
  }

  if (args instanceof ValueGetter) {
    return args;
  }

  if (isFunction(map[args[0]])) {
    return map[args[0]](args[1]);
  } else {
    throw new Error(`ValueType: ${args[0]} is not support`);
  }
}

function lineSegIntegrate (t: number, t0: number, t1: number, y0: number, y1: number) {
  const h = t - t0;

  return (y0 + y0 + (y1 - y0) * h / (t1 - t0)) * h / 2;
}

function lineSegIntegrateByTime (t: number, t0: number, t1: number, y0: number, y1: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  const t02 = t0 * t0;
  const t03 = t02 * t0;

  return (2 * t3 * (y0 - y1) + 3 * t2 * (t0 * y1 - t1 * y0) - t03 * (2 * y0 + y1) + 3 * t02 * t1 * y0) / (6 * (t0 - t1));
}

function curveValueEvaluate (time: number, keyframe0: number[], keyframe1: number[]) {
  const dt = keyframe1[CURVE_PRO_TIME] - keyframe0[CURVE_PRO_TIME];

  const m0 = keyframe0[CURVE_PRO_OUT_TANGENT] * dt;
  const m1 = keyframe1[CURVE_PRO_IN_TANGENT] * dt;

  const t = (time - keyframe0[CURVE_PRO_TIME]) / dt;
  const t2 = t * t;
  const t3 = t2 * t;

  const a = 2 * t3 - 3 * t2 + 1;
  const b = t3 - 2 * t2 + t;
  const c = t3 - t2;
  const d = -2 * t3 + 3 * t2;

  //(2*v0+m0+m1-2*v1)*(t-t0)^3/k^3+(3*v1-3*v0-2*m0-m1)*(t-t0)^2/k^2+m0 *(t-t0)/k+v0
  return a * keyframe0[CURVE_PRO_VALUE] + b * m0 + c * m1 + d * keyframe1[CURVE_PRO_VALUE];
}

function curveValueIntegrate (time: number, keyframe0: number[], keyframe1: number[]) {
  const k = keyframe1[CURVE_PRO_TIME] - keyframe0[CURVE_PRO_TIME];
  const m0 = keyframe0[CURVE_PRO_OUT_TANGENT] * k;
  const m1 = keyframe1[CURVE_PRO_IN_TANGENT] * k;
  const t0 = keyframe0[CURVE_PRO_TIME];
  const v0 = keyframe0[CURVE_PRO_VALUE];
  const v1 = keyframe1[CURVE_PRO_VALUE];

  const dt = t0 - time;
  const dt2 = dt * dt;
  const dt3 = dt2 * dt;

  return (m0 + m1 + 2 * v0 - 2 * v1) * dt3 * dt / (4 * k * k * k) +
    (2 * m0 + m1 + 3 * v0 - 3 * v1) * dt3 / (3 * k * k) +
    m0 * dt2 / 2 / k - v0 * dt;
}

function curveValueIntegrateByTime (t1: number, keyframe0: number[], keyframe1: number[]) {
  const k = keyframe1[CURVE_PRO_TIME] - keyframe0[CURVE_PRO_TIME];
  const m0 = keyframe0[CURVE_PRO_OUT_TANGENT] * k;
  const m1 = keyframe1[CURVE_PRO_IN_TANGENT] * k;
  const t0 = keyframe0[CURVE_PRO_TIME];
  const v0 = keyframe0[CURVE_PRO_VALUE];
  const v1 = keyframe1[CURVE_PRO_VALUE];

  const dt = t0 - t1;
  const dt2 = dt * dt;
  const dt3 = dt2 * dt;
  const k2 = k * k;
  const k3 = k2 * k;
  //(30 k^3 v0 (t1^2 - t0^2) + 10 k^2 m0 (t0 + 2 t1) (t0 - t1)^2 + 5 k (t0 + 3 t1) (t0 - t1)^3 (2 m0 + m1 + 3 v0 - 3 v1) + 3 (t0 + 4 t1) (t0 - t1)^4 (m0 + m1 + 2 v0 - 2 v1))/(60 k^3)
  const ret = -30 * k3 * v0 * (t0 + t1) * dt +
    10 * k2 * m0 * (t0 + 2 * t1) * dt2 +
    5 * k * (t0 + 3 * t1) * (2 * m0 + m1 + 3 * v0 - 3 * v1) * dt3 +
    3 * (t0 + 4 * t1) * (m0 + m1 + 2 * v0 - 2 * v1) * dt3 * dt;

  return ret / 60 / k3;
}

export function getKeyFrameMetaByRawValue (meta: KeyFrameMeta, value?: [type: spec.ValueType, value: any]) {
  if (value) {
    const type = value[0];
    const keys = value[1] as spec.vec4[];

    if (type === spec.ValueType.CURVE) {
      meta.curves.push(keys as any);
      let keyLen = keys.length;

      if (keys[0][0] > 0) {
        keyLen++;
      }
      if (keys[keys.length - 1][0] < 1) {
        keyLen++;
      }
      meta.index += keyLen;
      meta.max = Math.max(meta.max, keyLen);
      meta.curveCount += keyLen;
    } else if (type === spec.ValueType.LINE) {
      let keyLen = keys.length;

      if (keyLen === 2 && keys[0][0] === 0 && keys[1][0] === 1) {
        return;
      }
      if (keys[0][0] > 0) {
        keyLen++;
      }
      if (keys[keys.length - 1][0] < 1) {
        keyLen++;
      }
      const uniformCount = Math.ceil(keyLen / 2);

      meta.lineSegCount += uniformCount;
      meta.curves.push(keys as any);
      meta.index += uniformCount;
      meta.max = Math.max(meta.max, uniformCount);
    }
  }
}

export function createKeyFrameMeta () {
  return {
    curves: [],
    index: 0,
    max: 0,
    lineSegCount: 0,
    curveCount: 0,
  };
}
