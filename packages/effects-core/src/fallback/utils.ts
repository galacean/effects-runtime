import type {
  FixedNumberExpression, RGBAColorValue, ColorExpression, NumberExpression, GradientColor,
  GradientStop, FixedVec3Expression, vec2, vec3, vec4, BezierKeyframeValue,
} from '@galacean/effects-specification';
import { BezierKeyframeType, ValueType, ParticleOrigin } from '@galacean/effects-specification';

export function arrAdd<T> (arr: T[], item: T): boolean | undefined {
  if (!arr.includes(item)) {
    arr.push(item);

    return true;
  }
}

export function ensureFixedNumber (a: any): FixedNumberExpression | undefined {
  if (Number.isFinite(a)) {
    return [ValueType.CONSTANT, a];
  }
  if (a) {
    const valueType = a[0];
    const valueData = a[1];

    if (Array.isArray(valueType)) {
      // 没有数据类型的数据
      return;
    }

    if (valueType === 'static' || valueType === ValueType.CONSTANT) {
      return [ValueType.CONSTANT, a[1]];
    }
    if (valueType === 'lines') {
      return [ValueType.LINE, a[1]];
    }
    if (valueType === ValueType.LINE) {
      // @ts-expect-error
      const keyframes: LineKeyframeValue[] = valueData.map(data => [BezierKeyframeType.LINE, data]);

      return [ValueType.BEZIER_CURVE, keyframes];
    }
    if (valueType === 'curve' || valueType === ValueType.CURVE) {
      return [ValueType.BEZIER_CURVE, getBezierCurveFromHermiteInGE(valueData)];
    }

    return a;
  }
}

export function ensureFixedNumberWithRandom (a: any, p: number): FixedNumberExpression | undefined {
  if (Array.isArray(a) && a[0] === 'random') {
    return [ValueType.CONSTANT, a[1][p]];
  }

  return ensureFixedNumber(a);
}

export function ensureRGBAValue (a: any): RGBAColorValue {
  if (a && a[0] === 'color') {
    return colorToArr(a[1], true);
  }

  return [1, 1, 1, 1];
}

export function ensureColorExpression (a: any, normalized?: boolean): ColorExpression | undefined {
  if (a) {
    if (a[0] === 'colors') {
      return [ValueType.COLORS, a[1].map((color: any) => colorToArr(color, normalized))];
    } else if (a[0] === 'gradient') {
      return ensureGradient(a[1], normalized);
    } else if (a[0] === 'color') {
      return [ValueType.RGBA_COLOR, colorToArr(a[1], normalized)];
    }

    return a;
  }
}

export function ensureNumberExpression (a: any): NumberExpression | undefined {
  if (a && a[0] === 'random') {
    return [ValueType.RANDOM, a[1]];
  }

  return ensureFixedNumber(a);
}

export function ensureGradient (a: any, normalized?: boolean): GradientColor | undefined {
  if (a) {
    let stops: GradientStop[] = [];

    Object.getOwnPropertyNames(a).forEach(p => {
      const stop = parsePercent(p);
      const color = colorToArr(a[p], normalized);

      stops.push([stop, color[0], color[1], color[2], color[3]]);
    });
    stops = stops.sort((a, b) => a[0] - b[0]);

    return [ValueType.GRADIENT_COLOR, stops];
  }
}

export function colorToArr (hex: string | number[], normalized?: boolean): vec4 {
  let ret: vec4;

  if (typeof hex === 'string') {
    hex = hex.replace(/[\s\t\r\n]/g, '');
    let m = /rgba?\(([.\d]+),([.\d]+),([.\d]+),?([.\d]+)?\)/.exec(hex);

    if (m) {
      const a = +m[4];

      ret = [+m[1], +m[2], +m[3], isNaN(a) ? 255 : Math.round(a * 255)];
    } else if (/^#[a-f\d]{3}$/i.test(hex)) {
      ret = [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16), 255];
      // eslint-disable-next-line no-cond-assign
    } else if (m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)) {
      ret = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255];
    }
  } else if (hex instanceof Array) {
    ret = [hex[0], hex[1], hex[2], isNaN(hex[3]) ? 255 : Math.round(hex[3] * 255)];
  }

  if (normalized) {
    // @ts-expect-error
    ret = normalizeColor(ret) as unknown as vec4;
  }

  // @ts-expect-error
  return ret;
}

export function normalizeColor (a: number[]): number[] | undefined {
  if (Array.isArray(a)) {
    return a.map(i => Number.isFinite(i / 255) ? Number((i / 255).toFixed(6)) : 0);
  }
}

export function parsePercent (c: string): number {
  const match = /^(-)?([\d+.]+)%$/.exec(c);

  if (match) {
    return +match[2] / 100 * (match[1] ? -1 : 1);
  }

  return +c;
}

export function getGradientColor (color: string | Array<string | number[]> | GradientColor, normalized?: boolean): GradientColor | undefined {
  if (Array.isArray(color)) {
    if (color[0] === ValueType.GRADIENT_COLOR) {
      return color as GradientColor;
    }

    // @ts-expect-error
    return (color[0] === 'gradient' || color[0] === 'color') && ensureGradient(color[1], normalized);
  } else {
    return ensureGradient(color, normalized);
  }
}

export function ensureFixedVec3 (a: any): FixedVec3Expression | undefined {
  if (a) {
    if (a.length === 3) {
      return [ValueType.CONSTANT_VEC3, a];
    }
    const valueType = a[0];

    if (
      valueType === 'path' ||
      valueType === 'bezier' ||
      valueType === ValueType.BEZIER_PATH ||
      valueType === ValueType.LINEAR_PATH
    ) {
      const valueData = a[1];
      const easing = valueData[0];
      const points = valueData[1];
      let controlPoints = valueData[2];
      const bezierEasing = getBezierCurveFromHermiteInGE(easing);

      // linear path没有controlPoints
      if (!controlPoints) {
        controlPoints = [];
        for (let keyframeIndex = 0; keyframeIndex < points.length; keyframeIndex++) {
          const point = points[keyframeIndex].slice();

          if (keyframeIndex === 0) {
            controlPoints.push(point);
          } else if (keyframeIndex < points.length - 1) {
            controlPoints.push(point);
            controlPoints.push(point);
          } else {
            controlPoints.push(point);
          }
        }
      }

      return [ValueType.BEZIER_CURVE_PATH, [bezierEasing, points, controlPoints]];
    }

    return a;
  }
}

export function objectValueToNumber (o: Record<string, any>): object {
  for (const key of Object.keys(o)) {
    o[key] = Number(o[key]);
  }

  return o;
}

export function deleteEmptyValue (o: Record<string, any>): object {
  for (const key of Object.keys(o)) {
    if (o[key] === undefined) {
      delete o[key];
    }
  }

  return o;
}

const cos = Math.cos;
const sin = Math.sin;
const d2r = Math.PI / 180;
const r2d = 180 / Math.PI;

export function quatFromXYZRotation (out: vec4 | number[], x: number, y: number, z: number): vec4 {
  const c1 = cos((x * d2r) / 2);
  const c2 = cos((y * d2r) / 2);
  const c3 = cos((z * d2r) / 2);

  const s1 = sin((x * d2r) / 2);
  const s2 = sin((y * d2r) / 2);
  const s3 = sin((z * d2r) / 2);

  out[0] = s1 * c2 * c3 + c1 * s2 * s3;
  out[1] = c1 * s2 * c3 - s1 * c2 * s3;
  out[2] = c1 * c2 * s3 + s1 * s2 * c3;
  out[3] = c1 * c2 * c3 - s1 * s2 * s3;

  return out as vec4;
}

function clamp (v: number, min: number, max: number): number {
  return v > max ? max : (v < min ? min : v);
}

export function rotationZYXFromQuat (out: vec3 | number[], quat: vec4): vec3 {
  const x = quat[0];
  const y = quat[1];
  const z = quat[2];
  const w = quat[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const yx = y * x2;
  const yy = y * y2;
  const zx = z * x2;
  const zy = z * y2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const m11 = 1 - yy - zz, m12 = yx - wz, _m13 = zx + wy;
  const m21 = yx + wz, m22 = 1 - xx - zz, _m23 = zy - wx;
  const m31 = zx - wy, m32 = zy + wx, m33 = 1 - xx - yy;

  out[1] = Math.asin(clamp(-m31, -1, 1)) * r2d;
  if (Math.abs(m31) < 0.9999999) {
    out[0] = Math.atan2(m32, m33) * r2d;
    out[2] = Math.atan2(m21, m11) * r2d;
  } else {
    out[0] = 0;
    out[2] = Math.atan2(-m12, m22) * r2d;
  }

  return out as vec3;
}

/**
 * 提取并转换 JSON 数据中的 anchor 值
 */
export function convertAnchor (
  anchor?: vec2,
  particleOrigin?: ParticleOrigin,
): vec2 {
  if (anchor) {
    return [anchor[0] - 0.5, 0.5 - anchor[1]];
  } else if (particleOrigin) {
    return particleOriginTranslateMap[particleOrigin];
  } else {
    return [0, 0];
  }
}

export const particleOriginTranslateMap: Record<number, vec2> = {
  [ParticleOrigin.PARTICLE_ORIGIN_CENTER]: [0, 0],
  [ParticleOrigin.PARTICLE_ORIGIN_CENTER_BOTTOM]: [0, -0.5],
  [ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP]: [0, 0.5],
  [ParticleOrigin.PARTICLE_ORIGIN_LEFT_TOP]: [-0.5, 0.5],
  [ParticleOrigin.PARTICLE_ORIGIN_LEFT_CENTER]: [-0.5, 0],
  [ParticleOrigin.PARTICLE_ORIGIN_LEFT_BOTTOM]: [-0.5, -0.5],
  [ParticleOrigin.PARTICLE_ORIGIN_RIGHT_CENTER]: [0.5, 0],
  [ParticleOrigin.PARTICLE_ORIGIN_RIGHT_BOTTOM]: [0.5, -0.5],
  [ParticleOrigin.PARTICLE_ORIGIN_RIGHT_TOP]: [0.5, 0.5],
};

function getBezierCurveFromHermite (m0: number, m1: number, p0: number[], p3: number[]) {
  const xStart = p0[0];
  const yStart = p0[1];
  const xEnd = p3[0];
  const yEnd = p3[1];
  const dt = xEnd - xStart;

  m0 = m0 * dt;
  m1 = m1 * dt;
  const bezierControlPoints = [[xStart + (xEnd - xStart) / 3, yStart + m0 / 3], [xEnd - (xEnd - xStart) / 3, yEnd - m1 / 3]];

  return bezierControlPoints;
}

export function getBezierCurveFromHermiteInGE (geHermiteCurves: number[][]): BezierKeyframeValue[] {
  let ymax = -1000000;
  let ymin = 1000000;

  for (let i = 0; i < geHermiteCurves.length; i++) {
    ymax = Math.max(ymax, geHermiteCurves[i][1]);
    ymin = Math.min(ymin, geHermiteCurves[i][1]);
  }
  const geBezierCurves = [[geHermiteCurves[0][0], geHermiteCurves[0][1]]];

  for (let i = 0; i < geHermiteCurves.length - 1; i++) {
    const m0 = geHermiteCurves[i][3] * (ymax - ymin);
    const m1 = geHermiteCurves[i + 1][2] * (ymax - ymin);
    const p0 = [geHermiteCurves[i][0], geHermiteCurves[i][1]];
    const p3 = [geHermiteCurves[i + 1][0], geHermiteCurves[i + 1][1]];

    if (p0[0] != p3[0]) {
      const bezierControlPoints = getBezierCurveFromHermite(m0, m1, p0, p3);
      const p1 = bezierControlPoints[0];
      const p2 = bezierControlPoints[1];

      geBezierCurves[geBezierCurves.length - 1].push(p1[0]);
      geBezierCurves[geBezierCurves.length - 1].push(p1[1]);
      geBezierCurves.push([p2[0], p2[1], p3[0], p3[1]]);
    } else {
      geBezierCurves[geBezierCurves.length - 1].push(p3[0]);
      geBezierCurves[geBezierCurves.length - 1].push(p3[1]);
    }
  }

  // 添加关键帧类型
  return geBezierCurves.map((curve, index) => {
    return index === 0 ? [BezierKeyframeType.EASE_OUT, curve as [number, number, number, number]]
      : index === geBezierCurves.length - 1 ? [BezierKeyframeType.EASE_IN, curve as [number, number, number, number]]
        : [BezierKeyframeType.EASE, curve as [number, number, number, number, number, number]];
  });
}
