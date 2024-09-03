import { clamp } from '@galacean/effects-math/es/core/utils';
import type { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import * as spec from '@galacean/effects-specification';
import { colorToArr, colorStopsFromGradient, interpolateColor, isFunction } from '../utils';
import type { ColorStop } from '../utils';
import type { BezierEasing } from './bezier';
import { BezierPath, buildEasingCurve, BezierQuat } from './bezier';
import { Float16ArrayWrapper } from './float16array-wrapper';
import { numberToFix } from './utils';
import { HELP_LINK } from '../constants';

interface KeyFrameMeta {
  curves: ValueGetter<any>[],
  index: number,
  max: number,
  lineSegCount: number,
  curveCount: number,
}

const CURVE_PRO_TIME = 0;
const CURVE_PRO_VALUE = 1;
const CURVE_PRO_IN_TANGENT = 2;
const CURVE_PRO_OUT_TANGENT = 3;
const NOT_IMPLEMENT = 'not_implement';

export class ValueGetter<T> {
  static getAllData (meta: KeyFrameMeta, halfFloat?: boolean): Uint16Array | Float32Array {
    const ret = new (halfFloat ? Float16ArrayWrapper : Float32Array)(meta.index * 4);

    for (let i = 0, cursor = 0, curves = meta.curves; i < curves.length; i++) {
      const data = (curves[i] as BezierCurve).toData();

      ret.set(data, cursor);
      cursor += data.length;
    }

    return halfFloat ? (ret as Float16ArrayWrapper).data : (ret as Float32Array);
  }

  constructor (arg: any) {
    this.onCreate(arg);
  }

  onCreate (props: any) {
    throw new Error(NOT_IMPLEMENT);
  }

  getIntegrateValue (t0: number, t1: number, timeScale = 1): T {
    throw new Error(NOT_IMPLEMENT);
  }

  getIntegrateByTime (t0: number, time: number): T {
    throw new Error(NOT_IMPLEMENT);
  }

  getValue (time?: number): T {
    throw new Error(NOT_IMPLEMENT);
  }

  getMaxTime (): number {
    throw new Error(NOT_IMPLEMENT);
  }

  toUniform (meta: KeyFrameMeta): Float32Array {
    throw new Error(NOT_IMPLEMENT);
  }

  map (func: (n: T) => T) {
    throw new Error(NOT_IMPLEMENT);
  }

  scaleXCoord (scale: number): ValueGetter<T> {
    return this;
  }

  toData (): ArrayLike<number> {
    throw new Error(NOT_IMPLEMENT);
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

  override getMaxTime (): number {
    return 0;
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

  override getValue (time?: number, seed?: number): number {
    const randomSeed = seed ?? Math.random();

    return this.min + randomSeed * (this.max - this.min);
  }

  override getIntegrateValue (t0: number, t1: number, timeScale?: number): number {
    const seed = timeScale ?? 1.0;

    return (this.min + seed * (this.max - this.min)) * (t1 - t0);
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

  override toData () {
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

export class BezierCurve extends ValueGetter<number> {
  curveMap: Record<string, {
    points: Vector2[],
    timeInterval: number,
    valueInterval: number,
    curve: BezierEasing,
    timeStart: number,
    timeEnd: number,
  }>;
  keys: number[][];

  override onCreate (props: spec.BezierKeyframeValue[]) {
    const keyframes = props;

    this.curveMap = {};
    this.keys = [];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const leftKeyframe = keyframes[i];
      const rightKeyframe = keyframes[i + 1];

      const { points, curve, timeInterval, valueInterval } = buildEasingCurve(leftKeyframe, rightKeyframe);
      const s = points[0];
      const e = points[points.length - 1];

      this.keys.push([...s.toArray(), ...points[1].toArray()]);
      this.keys.push([...e.toArray(), ...points[2].toArray()]);

      this.curveMap[`${s.x}&${e.x}`] = {
        points,
        timeInterval,
        valueInterval,
        curve,
        timeStart:Number(s.x),
        timeEnd:Number(e.x),
      };
    }
  }
  override getValue (time: number) {
    let result = 0;
    const keyTimeData = Object.keys(this.curveMap);

    const keyTimeStart = this.curveMap[keyTimeData[0]].timeStart;
    const keyTimeEnd = this.curveMap[keyTimeData[keyTimeData.length - 1]].timeEnd;

    // const keyTimeStart = Number(keyTimeData[0].split('&')[0]);
    // const keyTimeEnd = Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);

    if (time <= keyTimeStart) {
      return this.getCurveValue(keyTimeData[0], keyTimeStart);
    }
    if (time >= keyTimeEnd) {
      return this.getCurveValue(keyTimeData[keyTimeData.length - 1], keyTimeEnd);
    }

    for (let i = 0; i < keyTimeData.length; i++) {
      const xMin = this.curveMap[keyTimeData[i]].timeStart;
      const xMax = this.curveMap[keyTimeData[i]].timeEnd;

      // const [xMin, xMax] = keyTimeData[i].split('&');

      if (time >= Number(xMin) && time < Number(xMax)) {
        result = this.getCurveValue(keyTimeData[i], time);

        break;
      }
    }

    return result;
  }

  override getIntegrateValue (t0: number, t1: number, ts = 1) {
    const time = (t1 - t0) / ts;

    let result = 0;
    const keyTimeData = Object.keys(this.curveMap);
    const keyTimeStart = this.curveMap[keyTimeData[0]].timeStart;

    if (time <= keyTimeStart) {
      return 0;
    }
    for (let i = 0; i < keyTimeData.length; i++) {
      const xMin = this.curveMap[keyTimeData[i]].timeStart;
      const xMax = this.curveMap[keyTimeData[i]].timeEnd;

      if (time >= Number(xMax)) {
        result += ts * this.getCurveIntegrateValue(keyTimeData[i], Number(xMax));
      }

      if (time >= Number(xMin) && time < Number(xMax)) {
        result += ts * this.getCurveIntegrateValue(keyTimeData[i], time);

        break;
      }
    }

    return result;
  }

  override getIntegrateByTime (t0: number, t1: number) {
    return this.getIntegrateValue(0, t1) - this.getIntegrateValue(0, t0);
  }
  // 速度变化曲线面板移除后下线
  getCurveIntegrateValue (curveKey: string, time: number) {
    const curveInfo = this.curveMap[curveKey];
    const [p0] = curveInfo.points;
    const timeInterval = curveInfo.timeInterval;
    const valueInterval = curveInfo.valueInterval;
    const segments = 20;
    let total = 0;
    const h = (time - p0.x) / segments;

    for (let i = 0; i <= segments; i++) {
      const t = i * h;
      const normalizeTime = t / timeInterval;
      const y = p0.y + valueInterval * curveInfo.curve.getValue(normalizeTime);

      if (i === 0 || i === segments) {
        total += y;
      } else if (i % 2 === 1) {
        total += 4 * y;
      } else {
        total += 2 * y;
      }

    }
    total *= h / 3;

    return total;
  }

  getCurveValue (curveKey: string, time: number) {
    const curveInfo = this.curveMap[curveKey];
    const [p0] = curveInfo.points;
    const timeInterval = curveInfo.timeInterval;
    const valueInterval = curveInfo.valueInterval;
    const normalizeTime = (time - p0.x) / timeInterval;
    const value = curveInfo.curve.getValue(normalizeTime);

    return p0.y + valueInterval * value;

  }

  override toUniform (meta: KeyFrameMeta): Float32Array {
    const index = meta.index;
    const count = this.keys.length;

    meta.curves.push(this);
    meta.index = index + count;
    // 兼容 WebGL1
    meta.max = Math.max(meta.max, count);
    meta.curveCount += count;

    return new Float32Array([5, index + 1 / count, index, count]);
  }

  override toData (): Float32Array {
    const keys = this.keys;
    const data = new Float32Array(keys.length * 4);

    for (let i = 0, cursor = 0; i < keys.length; i++, cursor += 4) {
      data.set(keys[i], cursor);
    }

    return data;
  }

  override getMaxTime (): number {
    const keyTimeData = Object.keys(this.curveMap);

    return Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);
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

export class BezierCurvePath extends ValueGetter<Vector3> {
  curveSegments: Record<string, {
    points: Vector2[],
    // 缓动曲线
    easingCurve: BezierEasing,
    timeInterval: number,
    valueInterval: number,
    // 路径曲线
    pathCurve: BezierPath,
  }>;

  override onCreate (props: spec.BezierCurvePathValue) {
    const [keyframes, points, controlPoints] = props;

    this.curveSegments = {};
    if (!controlPoints.length) {
      return;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const leftKeyframe = keyframes[i];
      const rightKeyframe = keyframes[i + 1];
      const ps1 = new Vector3(points[i][0], points[i][1], points[i][2]), ps2 = new Vector3(points[i + 1][0], points[i + 1][1], points[i + 1][2]);

      const cp1 = new Vector3(controlPoints[2 * i][0], controlPoints[2 * i][1], controlPoints[2 * i][2]), cp2 = new Vector3(controlPoints[2 * i + 1][0], controlPoints[2 * i + 1][1], controlPoints[2 * i + 1][2]);

      const { points: ps, curve: easingCurve, timeInterval, valueInterval } = buildEasingCurve(leftKeyframe, rightKeyframe);
      const s = ps[0];
      const e = ps[ps.length - 1];

      const pathCurve = new BezierPath(ps1, ps2, cp1, cp2);

      this.curveSegments[`${s.x}&${e.x}`] = {
        points: ps,
        timeInterval,
        valueInterval,
        easingCurve,
        pathCurve: pathCurve,
      };
    }

  }

  override getValue (time: number): Vector3 {
    const t = numberToFix(time, 5);
    let perc = 0, point = new Vector3();
    const keyTimeData = Object.keys(this.curveSegments);

    if (!keyTimeData.length) {
      return point;
    }
    const keyTimeStart = Number(keyTimeData[0].split('&')[0]);
    const keyTimeEnd = Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);

    if (t <= keyTimeStart) {
      const pathCurve = this.curveSegments[keyTimeData[0]].pathCurve;

      point = pathCurve.getPointInPercent(0);

      return point;

    }
    if (t >= keyTimeEnd) {
      const pathCurve = this.curveSegments[keyTimeData[keyTimeData.length - 1]].pathCurve;

      point = pathCurve.getPointInPercent(1);

      return point;
    }

    for (let i = 0; i < keyTimeData.length; i++) {
      const [xMin, xMax] = keyTimeData[i].split('&');

      if (t >= Number(xMin) && t < Number(xMax)) {
        const bezierPath = this.curveSegments[keyTimeData[i]].pathCurve;

        perc = this.getPercValue(keyTimeData[i], t);

        point = bezierPath.getPointInPercent(perc);
      }
    }

    return point;
  }

  getPercValue (curveKey: string, time: number) {
    const curveInfo = this.curveSegments[curveKey];
    const [p0] = curveInfo.points;

    const timeInterval = curveInfo.timeInterval;
    const normalizeTime = numberToFix((time - p0.x) / timeInterval, 4);
    const value = curveInfo.easingCurve.getValue(normalizeTime);

    // TODO 测试用 编辑器限制值域后移除clamp
    return clamp(value, 0, 1);
  }

  override getMaxTime (): number {
    const keyTimeData = Object.keys(this.curveSegments);

    return Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);
  }
}

export class BezierCurveQuat extends ValueGetter<Quaternion> {
  curveSegments: Record<string, {
    points: Vector2[],
    // 缓动曲线
    easingCurve: BezierEasing,
    timeInterval: number,
    valueInterval: number,
    // 路径曲线
    pathCurve: BezierQuat,
  }>;

  override onCreate (props: spec.BezierCurveQuatValue) {
    const [keyframes, points, controlPoints] = props;

    this.curveSegments = {};
    if (!controlPoints.length) {
      return;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const leftKeyframe = keyframes[i];
      const rightKeyframe = keyframes[i + 1];
      const ps1 = Quaternion.fromArray(points[i]);
      const ps2 = Quaternion.fromArray(points[i + 1]);

      const cp1 = Quaternion.fromArray(controlPoints[2 * i]);
      const cp2 = Quaternion.fromArray(controlPoints[2 * i + 1]);

      const { points: ps, curve: easingCurve, timeInterval, valueInterval } = buildEasingCurve(leftKeyframe, rightKeyframe);
      const s = ps[0];
      const e = ps[ps.length - 1];

      const pathCurve = new BezierQuat(ps1, ps2, cp1, cp2);

      this.curveSegments[`${s.x}&${e.x}`] = {
        points: ps,
        timeInterval,
        valueInterval,
        easingCurve,
        pathCurve: pathCurve,
      };
    }

  }

  override getValue (time: number): Quaternion {
    let perc = 0;
    const t = numberToFix(time, 5);
    const keyTimeData = Object.keys(this.curveSegments);

    const keyTimeStart = Number(keyTimeData[0].split('&')[0]);
    const keyTimeEnd = Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);

    if (t <= keyTimeStart) {
      const pathCurve = this.curveSegments[keyTimeData[0]].pathCurve;

      return pathCurve.getPointInPercent(0);

    }
    if (t >= keyTimeEnd) {
      const pathCurve = this.curveSegments[keyTimeData[keyTimeData.length - 1]].pathCurve;

      return pathCurve.getPointInPercent(1);
    }

    for (let i = 0; i < keyTimeData.length; i++) {
      const [xMin, xMax] = keyTimeData[i].split('&');

      if (t >= Number(xMin) && t < Number(xMax)) {
        const pathCurve = this.curveSegments[keyTimeData[i]].pathCurve;

        perc = this.getPercValue(keyTimeData[i], t);

        return pathCurve.getPointInPercent(perc);
      }
    }

    const pathCurve = this.curveSegments[keyTimeData[0]].pathCurve;

    return pathCurve.getPointInPercent(0);
  }

  getPercValue (curveKey: string, time: number) {
    const curveInfo = this.curveSegments[curveKey];
    const [p0] = curveInfo.points;

    const timeInterval = curveInfo.timeInterval;
    const normalizeTime = numberToFix((time - p0.x) / timeInterval, 4);
    const value = curveInfo.easingCurve.getValue(normalizeTime);

    // TODO 测试用 编辑器限制值域后移除clamp
    return clamp(value, 0, 1);
  }

  override getMaxTime (): number {
    const keyTimeData = Object.keys(this.curveSegments);

    return Number(keyTimeData[keyTimeData.length - 1].split('&')[1]);
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
  [spec.ValueType.BEZIER_CURVE] (props: number[][][]) {
    if (props.length === 1) {
      return new StaticValue(props[0][1][1]);
    }

    return new BezierCurve(props);
  },
  [spec.ValueType.BEZIER_CURVE_PATH] (props: number[][][]) {
    if (props[0].length === 1) {
      return new StaticValue(new Vector3(...props[1][0]));
    }

    return new BezierCurvePath(props);
  },
  [spec.ValueType.BEZIER_CURVE_QUAT] (props: number[][][]) {
    if (props[0].length === 1) {
      return new StaticValue(new Quaternion(...props[1][0]));
    }

    return new BezierCurveQuat(props);
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
    throw new Error(`ValueType: ${args[0]} is not supported, see ${HELP_LINK['ValueType: 21/22 is not supported']}.`);
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
    } else if (type === spec.ValueType.BEZIER_CURVE) {
      const keyLen = keys.length - 1;

      meta.index += 2 * keyLen;
      meta.curves.push(keys as any);
      meta.max = Math.max(meta.max, 2 * keyLen);
      meta.curveCount += 2 * keyLen;
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
