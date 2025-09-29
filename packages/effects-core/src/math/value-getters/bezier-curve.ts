import * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Vector2Like } from '@galacean/effects-math/es/core/type';
import { NumberEpsilon } from '@galacean/effects-math/es/core/utils';
import { BezierEasing, BezierMap, getControlPoints } from '../bezier';
import type { KeyFrameMeta } from './value-getter';
import { ValueGetter } from './value-getter';
import { assertExist } from '../../utils';
import { decimalEqual, numberToFix } from '../utils';

interface CurveInfo {
  points: Vector2[],
  timeInterval: number,
  valueInterval: number,
  curve: BezierEasing,
  timeStart: number,
  timeEnd: number,
}

export interface Keyframe {
  time: number,
  value: number,
  inSlope: number,
  outSlope: number,
  inWeight: number,
  outWeight: number,
  weightedMode: WeightedMode,
  tangentMode: TangentMode,
}

export enum TangentMode {
  Cubic,
  Linear,
  Constant
}

export enum WeightedMode {
  None,
  In,
  Out,
  Both
}

export class BezierCurve extends ValueGetter<number> {
  curveMap: Record<string, CurveInfo>;
  keys: number[][];

  private keyFrames: Keyframe[];
  private curveInfos: CurveInfo[];

  override onCreate (props: spec.BezierKeyframeValue[]) {
    this.keyFrames = oldBezierKeyFramesToNew(props);
    const keyframes = this.keyFrames;

    this.curveMap = {};
    this.keys = [];
    this.curveInfos = [];

    for (let i = 0; i < keyframes.length - 1; i++) {
      const leftKeyframe = keyframes[i];
      const rightKeyframe = keyframes[i + 1];

      const { points, curve, timeInterval, valueInterval } = buildBezierEasing(leftKeyframe, rightKeyframe);
      const s = points[0];
      const e = points[points.length - 1];

      this.keys.push([...s.toArray(), ...points[1].toArray()]);
      this.keys.push([...e.toArray(), ...points[2].toArray()]);

      const curveInfo = {
        points,
        timeInterval,
        valueInterval,
        curve,
        timeStart: Number(s.x),
        timeEnd: Number(e.x),
      };

      this.curveMap[`${s.x}&${e.x}`] = curveInfo;
      this.curveInfos.push(curveInfo);
    }
  }

  override getValue (time: number) {
    let result = 0;
    const keysNumber = this.keyFrames.length;

    if (time <= this.keyFrames[0].time) {
      result = this.keyFrames[0].value;
    } else if (time < this.keyFrames[keysNumber - 1].time) {
      for (let i = 0; i < this.keyFrames.length - 1; i++) {
        const xMin = this.keyFrames[i].time;
        const xMax = this.keyFrames[i + 1].time;

        if (time >= xMin && time < xMax) {
          const curveInfo = this.curveInfos[i];
          const p0 = curveInfo.points[0];
          const timeInterval = curveInfo.timeInterval;
          const valueInterval = curveInfo.valueInterval;
          const normalizeTime = (time - p0.x) / timeInterval;
          const value = curveInfo.curve.getValue(normalizeTime);

          result = p0.y + valueInterval * value;

          break;
        }
      }
    } else if (time >= this.keyFrames[keysNumber - 1].time) {
      result = this.keyFrames[keysNumber - 1].value;
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
    return this.keyFrames[this.keyFrames.length - 1].time;
  }
}

function buildBezierEasing (leftKeyframe: Keyframe, rightKeyframe: Keyframe): {
  points: Vector2[],
  timeInterval: number,
  valueInterval: number,
  curve: BezierEasing,
} {
  const p0 = new Vector2(leftKeyframe.time, leftKeyframe.value);
  const p1 = new Vector2();
  const p2 = new Vector2();
  const p3 = new Vector2();

  const isWeighted = leftKeyframe.weightedMode === WeightedMode.Out ||
    leftKeyframe.weightedMode === WeightedMode.Both ||
    rightKeyframe.weightedMode === WeightedMode.In ||
    rightKeyframe.weightedMode === WeightedMode.Both;

  const isConstant = leftKeyframe.tangentMode === TangentMode.Constant;

  const rightDeltaX = (isWeighted ? leftKeyframe.outWeight : 1) * (rightKeyframe.time - leftKeyframe.time) / 3;

  p1.x = leftKeyframe.time + rightDeltaX;
  p1.y = leftKeyframe.value + rightDeltaX * (isConstant ? 0 : leftKeyframe.outSlope);

  const leftDeltaX = (isWeighted ? rightKeyframe.inWeight : 1) * (rightKeyframe.time - leftKeyframe.time) / 3;

  p2.x = rightKeyframe.time - leftDeltaX;
  p2.y = rightKeyframe.value - leftDeltaX * (isConstant ? 0 : rightKeyframe.inSlope);

  p3.x = rightKeyframe.time;
  p3.y = isConstant ? leftKeyframe.value : rightKeyframe.value;

  assertExist(p2);
  assertExist(p3);
  const timeInterval = p3.x - p0.x;
  const valueInterval = p3.y - p0.y;
  let y1, y2;
  let x1 = numberToFix((p1.x - p0.x) / timeInterval, 5);
  let x2 = numberToFix((p2.x - p0.x) / timeInterval, 5);

  if (decimalEqual(valueInterval, 0)) {
    y1 = y2 = NaN;
  } else {
    y1 = numberToFix((p1.y - p0.y) / valueInterval, 5);
    y2 = numberToFix((p2.y - p0.y) / valueInterval, 5);
  }

  if (x1 < 0) {
    console.error('Invalid bezier points, x1 < 0', p0, p1, p2, p3);
    x1 = 0;
  }
  if (x2 < 0) {
    console.error('Invalid bezier points, x2 < 0', p0, p1, p2, p3);
    x2 = 0;
  }
  if (x1 > 1) {
    console.error('Invalid bezier points, x1 >= 1', p0, p1, p2, p3);
    x1 = 1;
  }
  if (x2 > 1) {
    console.error('Invalid bezier points, x2 >= 1', p0, p1, p2, p3);
    x2 = 1;
  }

  const str = ('bez_' + x1 + '_' + y1 + '_' + x2 + '_' + y2).replace(/\./g, 'p');
  let bezEasing;

  if (BezierMap[str]) {
    bezEasing = BezierMap[str];
  } else {
    if (decimalEqual(valueInterval, 0)) {
      bezEasing = new BezierEasing();
    } else if (isWeighted) {
      bezEasing = new BezierEasing(x1, y1, x2, y2);
    } else {
      bezEasing = new BezierEasing(y1, y2);
    }
    BezierMap[str] = bezEasing;
  }

  return {
    points: [p0, p1, p2, p3],
    timeInterval,
    valueInterval,
    curve: bezEasing,
  };
}

interface KeyData {
  leftControl: Vector2Like,
  value: Vector2Like,
  rightControl: Vector2Like,
  tangentMode: TangentMode,
}

export function oldBezierKeyFramesToNew (props: spec.BezierKeyframeValue[]): Keyframe[] {
  const oldKeyframes = props;
  const keyframes: Keyframe[] = [];
  const keyDatas: KeyData[] = [];

  let lastControl: Vector2Like = { x: 0, y: 0 };

  for (let i = 0; i < oldKeyframes.length; i++) {
    const leftKeyframe = oldKeyframes[i];
    const rightKeyframe = i + 1 < oldKeyframes.length ? oldKeyframes[i + 1] : oldKeyframes[i];

    const { p0, p1, p2, p3 } = getControlPoints(leftKeyframe, rightKeyframe, true);

    assertExist(p2);
    assertExist(p3);
    const keyData = {
      leftControl: lastControl,
      value: p0,
      rightControl: p1,
      tangentMode: TangentMode.Cubic,
    };

    if (leftKeyframe[0] === spec.BezierKeyframeType.HOLD) {
      keyData.tangentMode = TangentMode.Constant;
    }

    keyDatas.push(keyData);
    lastControl = p2;
  }

  const calculateSlop = (p0: Vector2Like, p1: Vector2Like) => {
    return (p1.y - p0.y) / (p1.x - p0.x + NumberEpsilon);
  };

  for (let i = 0; i < keyDatas.length; i++) {
    const leftControl = keyDatas[i].leftControl;
    const value = keyDatas[i].value;
    const rightControl = keyDatas[i].rightControl;

    let inSlop = 0;
    let outSlop = 0;

    if (i > 0) {
      inSlop = calculateSlop(leftControl, value);
    }
    if (i < keyDatas.length - 1) {
      outSlop = calculateSlop(value, rightControl);
    }

    const keyframe: Keyframe = {
      time: value.x,
      value: value.y,
      inSlope: inSlop,
      outSlope: outSlop,
      inWeight: 0,
      outWeight: 0,
      tangentMode: keyDatas[i].tangentMode,
      weightedMode: WeightedMode.Both,
    };

    keyframes.push(keyframe);

    if (i > 0) {
      keyframe.inWeight = (value.x - leftControl.x) / ((value.x - keyDatas[i - 1].value.x) / 3);
    }

    if (i + 1 < keyDatas.length) {
      keyframe.outWeight = (rightControl.x - value.x) / ((keyDatas[i + 1].value.x - value.x) / 3);
    }
  }

  return keyframes;
}
