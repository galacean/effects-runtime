import type * as spec from '@galacean/effects-specification';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { keyframeInfo } from './keyframe-info';
import { decimalEqual, numberToFix } from './utils';
import { assertExist } from '../utils';

export class BezierLengthData {
  constructor (
    public points: Array<{ partialLength: number, point: Vector3 }>,
    public totalLength: number,
  ) {
  }
}
export const BezierMap: Record<string, BezierEasing> = {};
export const BezierDataMap: Record<string, BezierLengthData> = {};
const CURVE_SEGMENTS = 300;

// Cubic bezier easing, from https://github.com/gre/bezier-easing (MIT License).
// Solves x(t) = ((2a * t + 3b) * t + 3c) * t = x for t, with x in (0, 1):
// u = 1/t is the largest real root of x·u³ − 3c·u² − 3b·u − 2a = 0
function solveTForX (x: number, a: number, b: number, c: number) {
  const j = 1 / Math.max(c, Math.sqrt(x));
  const k = x * j;
  const l = k * j;
  const s = c * j;
  const q = b * l;
  const m = s * s + q;
  const h = -s * (s * s + 1.5 * q) - a * k * l;
  const D = h * h - m * m * m;
  let v: number;

  if (m === 0 || D > 1e-12 * h * h) {
    // one real root (Cardano)
    const U = -Math.cbrt(h < 0 ? h - Math.sqrt(D) : h + Math.sqrt(D));

    v = (U + m / U) || 0;
  } else {
    // three real roots, take the largest
    const r = Math.sqrt(m);

    v = 2 * r * Math.cos(Math.acos(Math.max(-1, Math.min(1, -h / (m * r)))) / 3);
  }

  return Math.min(1, k / (v + s));
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
  interval: Vector3,
} {
  // 使用平移后的终点、控制点作为key
  const s1 = numberToFix(p2.x - p1.x, 3) + '_' + numberToFix(p2.y - p1.y, 3) + '_' + numberToFix(p2.z - p1.z, 3);
  const s2 = numberToFix(p3.x - p1.x, 3) + '_' + numberToFix(p3.y - p1.y, 3) + '_' + numberToFix(p3.z - p1.z, 3);
  const s3 = numberToFix(p4.x - p1.x, 3) + '_' + numberToFix(p4.y - p1.y, 3) + '_' + numberToFix(p4.z - p1.z, 3);

  const str = s1 + '&' + s2 + '&' + s3;

  if (BezierDataMap[str]) {
    return {
      data: BezierDataMap[str],
      interval: p1,
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
      interval: new Vector3(p1.x, p1.y, p1.z),
    };
  }

}

export class BezierPath {
  public readonly lengthData: BezierLengthData;
  public readonly interval: Vector3;
  public readonly totalLength: number;
  private catching: {
    lastPoint: number,
    lastAddedLength: number,
  } = {
      lastPoint: 0,
      lastAddedLength: 0,
    };

  constructor (public p1: Vector3, public p2: Vector3, public p3: Vector3, public p4: Vector3) {
    const { data, interval } = buildBezierData(p1, p2, p3, p4);

    this.lengthData = data;
    this.interval = interval;
    this.totalLength = data.totalLength;
  }

  /**
   * 获取路径在指定比例长度上点的坐标
   * @param percent 路径长度的比例
   */
  getPointInPercent (percent: number) {
    const bezierData = this.lengthData;

    if (percent === 0) {
      return bezierData.points[0].point.clone().add(this.interval);
    }

    if (decimalEqual(1 - percent, 0)) {
      return bezierData.points[CURVE_SEGMENTS - 1].point.clone().add(this.interval);
    }
    if (decimalEqual(bezierData.totalLength, 0)) {
      return this.p1.clone();
    }

    const point = new Vector3();
    const segmentLength = numberToFix(bezierData.totalLength * percent, 4);

    let addedLength = this.catching.lastAddedLength;
    let j = this.catching.lastPoint;

    if (decimalEqual(addedLength, segmentLength)) {
      return bezierData.points[j].point.clone().add(this.interval);
    }

    let flag = true;
    let dir = 1;

    if (segmentLength < addedLength) {
      dir = -1;
    }

    while (flag) {
      if (segmentLength >= addedLength) {
        if (j === CURVE_SEGMENTS - 1) {
          point.x = bezierData.points[j].point.x;
          point.y = bezierData.points[j].point.y;
          point.z = bezierData.points[j].point.z;

          break;
        }
        if (segmentLength < addedLength + bezierData.points[j + 1].partialLength) {
          const segmentPerc = (segmentLength - addedLength) / bezierData.points[j + 1].partialLength;

          point.x = bezierData.points[j].point.x + (bezierData.points[j + 1].point.x - bezierData.points[j].point.x) * segmentPerc;
          point.y = bezierData.points[j].point.y + (bezierData.points[j + 1].point.y - bezierData.points[j].point.y) * segmentPerc;
          point.z = bezierData.points[j].point.z + (bezierData.points[j + 1].point.z - bezierData.points[j].point.z) * segmentPerc;

          break;
        }
      }
      if (dir > 0 && j < (CURVE_SEGMENTS - 1)) {
        j += dir;
        addedLength += numberToFix(bezierData.points[j].partialLength, 5);
      } else if (dir < 0 && j > 0) {
        addedLength -= numberToFix(bezierData.points[j].partialLength, 5);
        j += dir;
      } else {
        flag = false;
      }
    }
    this.catching.lastPoint = j;
    this.catching.lastAddedLength = addedLength;

    point.add(this.interval);

    return point;
  }

}

export class BezierQuat {
  private temp = new Quaternion();
  public readonly totalLength: number;

  constructor (public p1: Quaternion, public p2: Quaternion, public p3: Quaternion, public p4: Quaternion) {
    this.totalLength = 0;
  }

  /**
   * 获取路径在指定比例长度上点的坐标
   * @param percent 路径长度的比例
   */
  getPointInPercent (percent: number) {
    if (percent === 0) {
      return this.temp.copyFrom(this.p1);
    }

    if (decimalEqual(1 - percent, 0)) {
      return this.temp.copyFrom(this.p2);
    }

    QuaternionInner.slerpFlat(this.temp, this.p1, this.p2, percent);

    return this.temp;
  }

}

export class BezierEasing {
  private control1 = new Vector2();
  private control2 = new Vector2();
  private weighted = false;
  private isConstant = false;

  constructor ();
  constructor (control1: number, control2: number);
  constructor (control1X: number, control1Y: number, control2X: number, control2Y: number);
  constructor (control1YOrControl1X?: number, control2YOrControl1Y?: number, control2X?: number, control2Y?: number) {
    if (control1YOrControl1X !== undefined && control2YOrControl1Y !== undefined && control2X !== undefined && control2Y !== undefined) {
      this.control1.x = control1YOrControl1X;
      this.control1.y = control2YOrControl1Y;
      this.control2.x = control2X;
      this.control2.y = control2Y;
      this.weighted = true;
    } else if (control1YOrControl1X !== undefined && control2YOrControl1Y !== undefined) {
      this.control1.x = 1 / 3;
      this.control1.y = control1YOrControl1X;
      this.control2.x = 2 / 3;
      this.control2.y = control2YOrControl1Y;
    } else {
      this.isConstant = true;
    }
  }

  getValue (x: number) {
    if (this.isConstant) {
      return 0;
    }
    if (this.control1.x === this.control1.y && this.control2.x === this.control2.y) {
      return x;
    }
    if (x === 0 || x === 1) {
      return x;
    }
    if (!this.weighted) {
      return this.bezierInterpolate(0, this.control1.y, this.control2.y, 1, x);
    }
    // x outside (0, 1) saturates to 0 / 1
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }
    // x(t) = ((2a * t + 3b) * t + 3c) * t, y(t) = ((ay * t + by) * t + cy) * t
    const { x: x1, y: y1 } = this.control1;
    const { x: x2, y: y2 } = this.control2;
    const t = solveTForX(x, (3 * x1 - 3 * x2 + 1) / 2, x2 - 2 * x1, x1);

    return (((3 * y1 - 3 * y2 + 1) * t + 3 * (y2 - 2 * y1)) * t + 3 * y1) * t;
  }

  private bezierInterpolate (pStart: number, pControl1: number, pControl2: number, pEnd: number, t: number): number {
    // Formula from Wikipedia article on Bezier curves
    const omt = (1.0 - t);
    const omt2 = omt * omt;
    const omt3 = omt2 * omt;
    const t2 = t * t;
    const t3 = t2 * t;

    return pStart * omt3 + pControl1 * omt2 * t * 3.0 + pControl2 * omt * t2 * 3.0 + pEnd * t3;
  }
}

export function buildEasingCurve (leftKeyframe: spec.BezierKeyframeValue, rightKeyframe: spec.BezierKeyframeValue): {
  points: Vector2[],
  timeInterval: number,
  valueInterval: number,
  curve: BezierEasing,
} {
  // 获取控制点和曲线类型
  const { p0, p1, p2, p3 } = getControlPoints(leftKeyframe, rightKeyframe, true);

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
    } else {
      bezEasing = new BezierEasing(x1, y1, x2, y2);
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

/**
 * 根据关键帧类型获取贝塞尔曲线上的关键点
 */
export function getControlPoints (
  leftKeyframe: spec.BezierKeyframeValue,
  rightKeyframe: spec.BezierKeyframeValue,
  lineToBezier: boolean,
): ({ type: 'ease', p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean } | { type: 'line', p0: Vector2, p1: Vector2, p2?: Vector2, p3?: Vector2, isHold?: boolean, leftHoldLine?: boolean, rightHoldLine?: boolean }) {
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

    return { type: 'line', p0, p1: p2, p2: p3, p3: p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
  } else {
    return { type: 'line', p0, p1, isHold: leftHoldLine || rightHoldLine, leftHoldLine, rightHoldLine };
  }
}

class QuaternionInner {

  static slerpFlat (dst: Quaternion, src0: Quaternion, src1: Quaternion, t: number) {
    // fuzz-free, array-based Quaternion SLERP operation
    let x0 = src0.x;
    let y0 = src0.y;
    let z0 = src0.z;
    let w0 = src0.w;

    const x1 = src1.x;
    const y1 = src1.y;
    const z1 = src1.z;
    const w1 = src1.w;

    if (t === 0) {
      dst.x = x0;
      dst.y = y0;
      dst.z = z0;
      dst.w = w0;

      return;
    }

    if (t === 1) {
      dst.x = x1;
      dst.y = y1;
      dst.z = z1;
      dst.w = w1;

      return;
    }

    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let s = 1 - t;
      const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
      const dir = (cos >= 0 ? 1 : - 1);
      const sqrSin = 1 - cos * cos;

      // Skip the Slerp for tiny steps to avoid numeric problems:
      if (sqrSin > Number.EPSILON) {
        const sin = Math.sqrt(sqrSin);
        const len = Math.atan2(sin, cos * dir);

        s = Math.sin(s * len) / sin;
        t = Math.sin(t * len) / sin;
      }

      const tDir = t * dir;

      x0 = x0 * s + x1 * tDir;
      y0 = y0 * s + y1 * tDir;
      z0 = z0 * s + z1 * tDir;
      w0 = w0 * s + w1 * tDir;

      // Normalize in case we just did a lerp:
      if (s === 1 - t) {
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);

        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }

    dst.x = x0;
    dst.y = y0;
    dst.z = z0;
    dst.w = w0;
  }
}
