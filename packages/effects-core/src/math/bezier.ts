import { assertExist, decimalEqual, LinearValue, pointOnLine } from '@galacean/effects-core';
import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { BezierKeyframeValue } from '@galacean/effects-specification/dist/src/numberExpression';
import { keyframeInfo } from './keyframe-info';

export class BezierLengthData {
  constructor (
    public points: Array<{ partialLength: number, point: Vector3 }>,
    public totalLength: number,
  ) {
  }
}
export const BezierMap: Record<string, BezierEasing> = {};
export const BezierDataMap: Record<string, BezierLengthData> = {};
const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const CURVE_SEGMENTS = 120;

const kSplineTableSize = 11;
const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

function A (a1: number, a2: number) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
function B (a1: number, a2: number) { return 3.0 * a2 - 6.0 * a1; }
function C (a1: number) { return 3.0 * a1; }

// A * t ^ 3 + B * t ^ 2 + C * t
// Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
function calcBezier (t: number, a1: number, a2: number) {
  return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
}

// Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
function getSlope (t: number, a1: number, a2: number) {
  return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
}

function binarySubdivide (aX: number, aA: number, aB: number, mX1: number, mX2: number) {
  let currentX,
    currentT,
    i = 0;

  do {
    currentT = aA + (aB - aA) / 2.0;
    currentX = calcBezier(currentT, mX1, mX2) - aX;
    if (currentX > 0.0) {
      aB = currentT;
    } else {
      aA = currentT;
    }
  } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);

  return currentT;
}

function newtonRaphsonIterate (aX: number, aGuessT: number, mX1: number, mX2: number) {
  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = getSlope(aGuessT, mX1, mX2);

    if (currentSlope === 0.0) {return aGuessT;}
    const currentX = calcBezier(aGuessT, mX1, mX2) - aX;

    aGuessT -= currentX / currentSlope;
  }

  return aGuessT;
}

// de Casteljau算法构建曲线
/**
 * @param p1 起始点
 * @param p2 终点
 * @param p3 起始控制点
 * @param p4 终止控制点
 * @returns
 */
export function buildBezierData (p1: Vector3, p2: Vector3, p3: Vector3, p4: Vector3): {
  data: BezierLengthData,
  interval: number[],
} {
  // 使用平移后的终点、控制点作为key
  const s1 = Math.round((p2.x - p1.x) * 1000) / 1000 + '_' + Math.round((p2.y - p1.y) * 1000) / 1000 + '_' + Math.round((p2.z - p1.z) * 1000) / 1000;
  const s2 = Math.round((p3.x - p1.x) * 1000) / 1000 + '_' + Math.round((p3.y - p1.y) * 1000) / 1000 + '_' + Math.round((p3.z - p1.z) * 1000) / 1000;
  const s3 = Math.round((p4.x - p1.x) * 1000) / 1000 + '_' + Math.round((p4.y - p1.y) * 1000) / 1000 + '_' + Math.round((p4.z - p1.z) * 1000) / 1000;

  const str = s1 + '&' + s2 + '&' + s3;

  if (BezierDataMap[str]) {
    return {
      data: BezierDataMap[str],
      interval: p1.toArray(),
    };
  } else {
    const samples = [];
    let lastPoint = null, addedLength = 0, ptDistance = 0;
    const curveSegments = CURVE_SEGMENTS;

    for (let k = 0; k < curveSegments; k += 1) {
      const point = new Vector3();
      const perc = k / (curveSegments - 1);

      ptDistance = 0;

      point.x = 3 * Math.pow(1 - perc, 2) * perc * (p3.x - p1.x) + 3 * (1 - perc) * Math.pow(perc, 2) * (p4.x - p1.x) + Math.pow(perc, 3) * (p2.x - p1.x);
      point.y = 3 * Math.pow(1 - perc, 2) * perc * (p3.y - p1.y) + 3 * (1 - perc) * Math.pow(perc, 2) * (p4.y - p1.y) + Math.pow(perc, 3) * (p2.y - p1.y);
      point.z = 3 * Math.pow(1 - perc, 2) * perc * (p3.z - p1.z) + 3 * (1 - perc) * Math.pow(perc, 2) * (p4.z - p1.z) + Math.pow(perc, 3) * (p2.z - p1.z);

      if (lastPoint !== null) {
        ptDistance += Math.pow(point.x - lastPoint.x, 2);
        ptDistance += Math.pow(point.y - lastPoint.y, 2);
        ptDistance += Math.pow(point.z - lastPoint.z, 2);
      }
      lastPoint = point;
      ptDistance = Math.sqrt(ptDistance);
      addedLength += ptDistance;
      samples[k] = {
        partialLength: ptDistance,
        point,
      };

    }
    const data = new BezierLengthData(samples, addedLength);

    BezierDataMap[str] = data;

    return {
      data,
      interval: [p1.x, p1.y, p1.z],
    };
  }

}

export class BezierPath {
  public readonly lengthData: BezierLengthData;
  public readonly interval: number[];
  public readonly totalLength: number;
  private catching: {
    lastPoint: number,
    lastAddedLength: number,
  } = {
      lastPoint: 0,
      lastAddedLength: 0,
    };

  constructor (p1: Vector3, p2: Vector3, p3: Vector3, p4: Vector3) {
    const { data, interval } = buildBezierData(p1, p2, p3, p4);

    this.lengthData = data;
    this.interval = interval;
    this.totalLength = data.totalLength;
  }

  /**
   * 获取路径在指定比例长度上点的坐标
   * @param percent 路径长度的比例
   * @param lastIndex 开始计算的点
   */
  getPointInPercent (percent: number) {
    const point = new Vector3();
    const bezierData = this.lengthData;
    let flag = true, addedLength = this.catching.lastAddedLength;
    const distanceInLine = bezierData.totalLength * percent;
    const pNum = bezierData.points.length;
    let j = distanceInLine < this.catching.lastAddedLength ? 0 : this.catching.lastPoint;

    while (flag) {
      addedLength += bezierData.points[j].partialLength;
      if (distanceInLine === 0 || percent === 0 || j === pNum - 1) {
        point.x = bezierData.points[j].point.x;
        point.y = bezierData.points[j].point.y;
        point.z = bezierData.points[j].point.z;

        break;
      } else if (distanceInLine >= addedLength && distanceInLine < addedLength + bezierData.points[j + 1].partialLength) {
        const segmentPerc = (distanceInLine - addedLength) / bezierData.points[j + 1].partialLength;

        point.x = bezierData.points[j].point.x + (bezierData.points[j + 1].point.x - bezierData.points[j].point.x) * segmentPerc;
        point.y = bezierData.points[j].point.y + (bezierData.points[j + 1].point.y - bezierData.points[j].point.y) * segmentPerc;
        point.z = bezierData.points[j].point.z + (bezierData.points[j + 1].point.z - bezierData.points[j].point.z) * segmentPerc;

        break;
      }
      if (j < pNum - 1) {
        j += 1;
      } else {
        flag = false;
      }
    }

    this.catching.lastPoint = j;
    this.catching.lastAddedLength = addedLength - bezierData.points[j].partialLength;

    point.x += this.interval[0];
    point.y += this.interval[1];
    point.z += this.interval[2];

    return point;
  }

}
export class BezierEasing {
  private precomputed: boolean;
  private mSampleValues: Float32Array | Array<number>;
  public cachingValue: Record<string, number>;

  constructor (public mX1: number, public mY1: number, public mX2: number, public mY2: number) {
    this.mSampleValues = typeof Float32Array === 'function' ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
    this.precomputed = false;
    this.cachingValue = {};
  }

  precompute () {

    this.precomputed = true;
    if (this.mX1 !== this.mY1 || this.mX2 !== this.mY2) {
      this.calcSampleValues();
    }
  }

  getValue (x: number) {
    if (!this.precomputed) {
      this.precompute();
    }

    // linear
    if (this.mX1 === this.mY1 && this.mX2 === this.mY2) {
      return x;
    }
    // Because JavaScript number are imprecise, we should guarantee the extremes are right.
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }

    const keys = Object.keys(this.cachingValue);
    const index = keys.findIndex(key => decimalEqual(Number(key), x, 0.005));

    if (index !== -1) {
      return this.cachingValue[keys[index]];
    }

    const value = calcBezier(this.getTForX(x), this.mY1, this.mY2);

    if (keys.length < 300) {
      this.cachingValue[x] = value;
    }

    return value;
  }

  calcSampleValues () {

    for (let i = 0; i < kSplineTableSize; ++i) {
      this.mSampleValues[i] = calcBezier(i * kSampleStepSize, this.mX1, this.mX2);
    }
  }

  getTForX (aX: number) {
    const mSampleValues = this.mSampleValues, lastSample = kSplineTableSize - 1;
    let intervalStart = 0, currentSample = 1;

    for (; currentSample !== lastSample && mSampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += kSampleStepSize;
    }
    --currentSample;

    // Interpolate to provide an initial guess for t
    const dist = (aX - mSampleValues[currentSample]) / (mSampleValues[currentSample + 1] - mSampleValues[currentSample]);
    const guessForT = intervalStart + dist * kSampleStepSize;

    const initialSlope = getSlope(guessForT, this.mX1, this.mX2);

    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(aX, guessForT, this.mX1, this.mX2);
    } if (initialSlope === 0.0) {
      return guessForT;
    }

    return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, this.mX1, this.mX2);
  }

}

export function buildEasingCurve (leftKeyframe: BezierKeyframeValue, rightKeyframe: BezierKeyframeValue): {
  points: Vector2[],
  curve: LinearValue | BezierEasing,
} {
  // 获取控制点和曲线类型
  const { type, p0, p1, p2, p3 } = getControlPoints(leftKeyframe, rightKeyframe);

  if (type === 'line') {
    return {
      points: [p0, p1, p0, p1],
      curve: new LinearValue([p0.y, p1.y]),
    };

    // 2. 左右两边至少有一边为ease
  } else {
    const timeInterval = p3.x - p0.x;
    const valueInterval = p3.y - p0.y;

    if (decimalEqual(valueInterval, 0)) {
      return {
        points: [p0, p1, p2, p3],
        curve: new LinearValue([p3.y, p3.y]),
      };
    }

    let x1 = Math.round((p1.x - p0.x) / timeInterval * 100000) / 100000;
    let x2 = Math.round((p2.x - p0.x) / timeInterval * 100000) / 100000;
    const y1 = Math.round((p1.y - p0.y) / valueInterval * 100000) / 100000;
    const y2 = Math.round((p2.y - p0.y) / valueInterval * 100000) / 100000;

    if (x1 < 0) {
      console.error('invalid bezier points, x1 < 0', p0, p1, p2, p3);
      x1 = 0;
    }
    if (x2 < 0) {
      console.error('invalid bezier points, x2 < 0', p0, p1, p2, p3);
      x2 = 0;
    }
    if (x1 > 1) {
      console.error('invalid bezier points, x1 >= 1', p0, p1, p2, p3);
      x1 = 1;
    }
    if (x2 > 1) {
      console.error('invalid bezier points, x2 >= 1', p0, p1, p2, p3);
      x2 = 1;
    }

    const str = ('bez_' + x1 + '_' + y1 + '_' + x2 + '_' + y2).replace(/\./g, 'p');
    let bezEasing;

    if (BezierMap[str]) {
      bezEasing = BezierMap[str];
    } else {
      bezEasing = new BezierEasing(x1, x2, y1, y2);
      BezierMap[str] = bezEasing;
    }

    return {
      points: [p0, p1, p2, p3],
      curve: bezEasing,
    };
  }
}

/**
 * 根据关键帧类型获取贝塞尔曲线上的关键点
 */
export function getControlPoints (
  leftKeyframe: spec.BezierKeyframeValue,
  rightKeyframe: spec.BezierKeyframeValue,
  lineToBezier = false):
  ({ type: 'ease', p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean }
  | { type: 'line', p0: Vector2, p1: Vector2, p2?: Vector2, p3?: Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean }) {

  const [, leftValue] = leftKeyframe;

  const leftHoldLine = keyframeInfo.isHoldOutKeyframe(leftKeyframe);
  const rightHoldLine = keyframeInfo.isHoldInKeyframe(rightKeyframe);

  const leftEase = !rightHoldLine && keyframeInfo.isRightSideEase(leftKeyframe);
  const rightEase = !leftHoldLine && keyframeInfo.isLeftSideEase(rightKeyframe);

  // 1. 左边为ease，右边为line（补充右边的控制点，该点在曲线上的点的偏左边位置）
  if (leftEase && !rightEase && !rightHoldLine) {
    const p0 = new Vector2(leftValue[leftValue.length - 4], leftValue[leftValue.length - 3]);
    const p1 = new Vector2(leftValue[leftValue.length - 2], leftValue[leftValue.length - 1]);
    const rightPoint = keyframeInfo.getPointInCurve(rightKeyframe);
    const p3 = new Vector2(rightPoint.x, rightPoint.y);
    const p2 = new Vector2(p3.x - (p3.x - p0.x) / 10, p3.y);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  // 2. 左边为line，右边为ease（补充左边的控制点，该点在曲线上的点的偏右边位置）
  if (!leftEase && rightEase && !leftHoldLine) {
    const [, rightValue] = rightKeyframe;
    const leftPoint = keyframeInfo.getPointInCurve(leftKeyframe);
    const p0 = new Vector2(leftPoint.x, leftPoint.y);
    const p2 = new Vector2(rightValue[0], rightValue[1]);
    const p3 = new Vector2(rightValue[2], rightValue[3]);
    const p1 = new Vector2(p0.x + (p3.x - p0.x) / 10, p0.y);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  // 3. 左边为ease，右边为ease
  if (leftEase && rightEase) {
    const [, rightValue] = rightKeyframe;
    const p0 = new Vector2(leftValue[leftValue.length - 4], leftValue[leftValue.length - 3]);
    const p1 = new Vector2(leftValue[leftValue.length - 2], leftValue[leftValue.length - 1]);
    const p2 = new Vector2(rightValue[0], rightValue[1]);
    const p3 = new Vector2(rightValue[2], rightValue[3]);

    return { type: 'ease', p0, p1, p2, p3 };
  }

  // 4. 左边为line，右边为line
  const p0 = keyframeInfo.getPointInCurve(leftKeyframe);
  const p1 = keyframeInfo.getPointInCurve(rightKeyframe);

  if (leftHoldLine) {
    p1.y = p0.y; // 定格关键帧使用相同的点
  } else if (rightHoldLine) {
    p0.y = p1.y;
  }

  if (lineToBezier) {
    // 补上两个在直线上的控制点
    const p2 = new Vector2((p1.x - p0.x) / 3 + p0.x, (p1.y - p0.y) / 3 + p0.y);
    const p3 = new Vector2((p1.x - p0.x) / 3 * 2 + p0.x, (p1.y - p0.y) / 3 * 2 + p0.y);

    return { type: 'ease', p0, p1: p2, p2: p3, p3: p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
  } else {
    return { type: 'line', p0, p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
  }
}
