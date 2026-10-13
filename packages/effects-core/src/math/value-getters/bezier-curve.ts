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
  interpolationMode: InterpolationMode,
}

export enum InterpolationMode {
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
  keys: number[][];

  private keyFrames: Keyframe[];
  private curveInfos: (CurveInfo | undefined)[];

  override onCreate (props: spec.BezierKeyframeValue[]) {
    this.setKeyFrames(oldBezierKeyFramesToNew(props));
  }

  /** Returns a copy so key edits go through setKeyFrames and invalidate cached segments. */
  getKeyFrames (): Keyframe[] {
    const keyFrames: Keyframe[] = [];

    for (let i = 0; i < this.keyFrames.length; i++) {
      keyFrames.push({ ...this.keyFrames[i] });
    }

    return keyFrames;
  }

  setKeyFrames (keyFrames: readonly Keyframe[]): void {
    const copiedKeyFrames: Keyframe[] = [];

    for (let i = 0; i < keyFrames.length; i++) {
      copiedKeyFrames.push({ ...keyFrames[i] });
    }
    this.keyFrames = copiedKeyFrames;

    this.curveInfos = [];
    this.keys = [];
  }

  private getCurveInfo (index: number): CurveInfo {
    let curveInfo = this.curveInfos[index];

    if (!curveInfo) {
      const { points, curve, timeInterval, valueInterval } = buildBezierEasing(this.keyFrames[index], this.keyFrames[index + 1]);

      curveInfo = {
        points,
        timeInterval,
        valueInterval,
        curve,
        timeStart: points[0].x,
        timeEnd: points[3].x,
      };

      this.curveInfos[index] = curveInfo;
    }

    return curveInfo;
  }

  override getValue (time: number) {
    const keysNumber = this.keyFrames.length;

    if (keysNumber < 2) {
      return this.keyFrames[0]?.value ?? 0;
    }
    let result = 0;

    if (time <= this.keyFrames[0].time) {
      result = this.keyFrames[0].value;
    } else if (time < this.keyFrames[keysNumber - 1].time) {
      for (let i = 0; i < this.keyFrames.length - 1; i++) {
        const xMin = this.keyFrames[i].time;
        const xMax = this.keyFrames[i + 1].time;

        if (time >= xMin && time < xMax) {
          const curveInfo = this.getCurveInfo(i);
          const p0 = curveInfo.points[0];
          const timeInterval = curveInfo.timeInterval;
          const valueInterval = curveInfo.valueInterval;
          const normalizeTime = (time - p0.x) / timeInterval;
          let value = 0;

          if (this.keyFrames[i].interpolationMode === InterpolationMode.Linear) {
            value = normalizeTime;
          } else {
            value = curveInfo.curve.getValue(normalizeTime);
          }

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
    if (this.keyFrames.length < 2) {
      return (this.keyFrames[0]?.value ?? 0) * (t1 - t0);
    }
    const time = (t1 - t0) / ts;

    let result = 0;
    const keyTimeStart = this.keyFrames[0].time;

    if (time <= keyTimeStart) {
      return 0;
    }
    for (let i = 0; i < this.keyFrames.length - 1; i++) {
      const xMin = this.keyFrames[i].time;
      const xMax = this.keyFrames[i + 1].time;

      if (time >= xMax) {
        result += ts * this.integrateCurveInfo(this.getCurveInfo(i), xMax);
      }

      if (time >= xMin && time < xMax) {
        result += ts * this.integrateCurveInfo(this.getCurveInfo(i), time);

        break;
      }
    }

    return result;
  }

  override getIntegrateByTime (t0: number, t1: number) {
    if (this.keyFrames.length < 2) {
      return 0.5 * (this.keyFrames[0]?.value ?? 0) * (t1 * t1 - t0 * t0);
    }

    return this.getIntegrateValue(0, t1) - this.getIntegrateValue(0, t0);
  }

  private integrateCurveInfo (curveInfo: CurveInfo, time: number): number {
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
    if (this.keyFrames.length < 2) {
      return new Float32Array([0, this.keyFrames[0]?.value ?? 0, 0, 0]);
    }
    const index = meta.index;
    const count = (this.keyFrames.length - 1) * 2;

    meta.curves.push(this);
    meta.index = index + count;
    // 兼容 WebGL1
    meta.max = Math.max(meta.max, count);
    meta.curveCount += count;

    return new Float32Array([5, index + 1 / count, index, count]);
  }

  override toData (): Float32Array {
    const keys = this.keys;

    if (keys.length === 0) {
      for (let i = 0; i < this.keyFrames.length - 1; i++) {
        const { points } = this.getCurveInfo(i);

        keys.push([...points[0].toArray(), ...points[1].toArray()]);
        keys.push([...points[3].toArray(), ...points[2].toArray()]);
      }
    }

    const data = new Float32Array(keys.length * 4);

    for (let i = 0, cursor = 0; i < keys.length; i++, cursor += 4) {
      data.set(keys[i], cursor);
    }

    return data;
  }

  override getMaxTime (): number {
    return this.keyFrames[this.keyFrames.length - 1]?.time ?? 0;
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

  const isLinear = leftKeyframe.interpolationMode === InterpolationMode.Linear;
  const isWeighted = !isLinear && (leftKeyframe.weightedMode === WeightedMode.Out ||
    leftKeyframe.weightedMode === WeightedMode.Both ||
    rightKeyframe.weightedMode === WeightedMode.In ||
    rightKeyframe.weightedMode === WeightedMode.Both);

  const isConstant = leftKeyframe.interpolationMode === InterpolationMode.Constant;

  p3.x = rightKeyframe.time;
  p3.y = isConstant ? leftKeyframe.value : rightKeyframe.value;

  if (isLinear) {
    const deltaX = (p3.x - p0.x) / 3;
    const deltaY = (p3.y - p0.y) / 3;

    p1.set(p0.x + deltaX, p0.y + deltaY);
    p2.set(p3.x - deltaX, p3.y - deltaY);
  } else {
    const rightDeltaX = (isWeighted ? leftKeyframe.outWeight : 1) * (rightKeyframe.time - leftKeyframe.time) / 3;

    p1.x = leftKeyframe.time + rightDeltaX;
    p1.y = leftKeyframe.value + rightDeltaX * (isConstant ? 0 : leftKeyframe.outSlope);

    const leftDeltaX = (isWeighted ? rightKeyframe.inWeight : 1) * (rightKeyframe.time - leftKeyframe.time) / 3;

    p2.x = rightKeyframe.time - leftDeltaX;
    p2.y = rightKeyframe.value - leftDeltaX * (isConstant ? 0 : rightKeyframe.inSlope);
  }

  assertExist(p2);
  assertExist(p3);
  const timeInterval = p3.x - p0.x;
  const valueInterval = p3.y - p0.y;
  let y1, y2;
  let x1 = numberToFix((p1.x - p0.x) / timeInterval, 5);
  let x2 = numberToFix((p2.x - p0.x) / timeInterval, 5);

  if (decimalEqual(valueInterval, 0)) {
    y1 = y2 = NaN;
  } else if (isLinear) {
    x1 = y1 = 1 / 3;
    x2 = y2 = 2 / 3;
  } else {
    y1 = numberToFix((p1.y - p0.y) / valueInterval, 5);
    y2 = numberToFix((p2.y - p0.y) / valueInterval, 5);
  }

  if (x1 < 0) {
    x1 = 0;
  }
  if (x2 < 0) {
    x2 = 0;
  }
  if (x1 > 1) {
    x1 = 1;
  }
  if (x2 > 1) {
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
  interpolationMode: InterpolationMode,
}

export function oldBezierKeyFramesToNew (props: spec.BezierKeyframeValue[]): Keyframe[] {
  const oldKeyframes = props;
  const keyframes: Keyframe[] = [];
  const keyDatas: KeyData[] = [];

  let lastControl: Vector2Like = { x: 0, y: 0 };

  for (let i = 0; i < oldKeyframes.length; i++) {
    const leftKeyframe = oldKeyframes[i];
    const rightKeyframe = i + 1 < oldKeyframes.length ? oldKeyframes[i + 1] : oldKeyframes[i];

    const { p0, p1, p2, p3, type } = getControlPoints(leftKeyframe, rightKeyframe, true);

    assertExist(p2);
    assertExist(p3);
    const keyData = {
      leftControl: lastControl,
      value: p0,
      rightControl: p1,
      interpolationMode: type === 'line' ? InterpolationMode.Linear : InterpolationMode.Cubic,
    };

    if (leftKeyframe[0] === spec.BezierKeyframeType.HOLD) {
      keyData.interpolationMode = InterpolationMode.Constant;
    }

    keyDatas.push(keyData);
    lastControl = p2;
  }

  const calculateSlope = (p0: Vector2Like, p1: Vector2Like) => {
    return (p1.y - p0.y) / (p1.x - p0.x + NumberEpsilon);
  };

  for (let i = 0; i < keyDatas.length; i++) {
    const leftControl = keyDatas[i].leftControl;
    const value = keyDatas[i].value;
    const rightControl = keyDatas[i].rightControl;

    let inSlope = 0;
    let outSlope = 0;

    if (i > 0) {
      inSlope = calculateSlope(leftControl, value);
    }
    if (i < keyDatas.length - 1) {
      outSlope = calculateSlope(value, rightControl);
    }

    const keyframe: Keyframe = {
      time: value.x,
      value: value.y,
      inSlope: inSlope,
      outSlope: outSlope,
      inWeight: 0,
      outWeight: 0,
      interpolationMode: keyDatas[i].interpolationMode,
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
