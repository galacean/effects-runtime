import { Vector2 } from '@galacean/effects-math/es/core/vector2';

export function clampNumber (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerpNumber (start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function pointsEqual (left: Vector2, right: Vector2): boolean {
  return left.x === right.x && left.y === right.y;
}

export function clonePoint (point: Vector2): Vector2 {
  return new Vector2(point.x, point.y);
}

export function normalizeVector2 (x: number, y: number): Vector2 {
  const length = Math.hypot(x, y);

  if (length <= Number.EPSILON) {
    return new Vector2(1, 0);
  }

  return new Vector2(x / length, y / length);
}

export function cubicPointAt (points: readonly Vector2[], t: number): Vector2 {
  const oneMinusT = 1 - t;
  const oneMinusTSquare = oneMinusT * oneMinusT;
  const tSquare = t * t;
  const basis0 = oneMinusTSquare * oneMinusT;
  const basis1 = 3 * oneMinusTSquare * t;
  const basis2 = 3 * oneMinusT * tSquare;
  const basis3 = tSquare * t;

  return new Vector2(
    basis0 * points[0].x + basis1 * points[1].x + basis2 * points[2].x + basis3 * points[3].x,
    basis0 * points[0].y + basis1 * points[1].y + basis2 * points[2].y + basis3 * points[3].y,
  );
}

export function lineExtract (points: readonly Vector2[], startT: number, endT: number): [Vector2, Vector2] {
  return [
    new Vector2(lerpNumber(points[0].x, points[1].x, startT), lerpNumber(points[0].y, points[1].y, startT)),
    new Vector2(lerpNumber(points[0].x, points[1].x, endT), lerpNumber(points[0].y, points[1].y, endT)),
  ];
}

export function cubicSubdivide (points: readonly Vector2[], t: number): [Vector2[], Vector2[]] {
  const p01 = new Vector2(lerpNumber(points[0].x, points[1].x, t), lerpNumber(points[0].y, points[1].y, t));
  const p12 = new Vector2(lerpNumber(points[1].x, points[2].x, t), lerpNumber(points[1].y, points[2].y, t));
  const p23 = new Vector2(lerpNumber(points[2].x, points[3].x, t), lerpNumber(points[2].y, points[3].y, t));
  const p012 = new Vector2(lerpNumber(p01.x, p12.x, t), lerpNumber(p01.y, p12.y, t));
  const p123 = new Vector2(lerpNumber(p12.x, p23.x, t), lerpNumber(p12.y, p23.y, t));
  const p0123 = new Vector2(lerpNumber(p012.x, p123.x, t), lerpNumber(p012.y, p123.y, t));

  return [
    [clonePoint(points[0]), p01, p012, p0123],
    [p0123, p123, p23, clonePoint(points[3])],
  ];
}

export function cubicExtract (points: readonly Vector2[], startT: number, endT: number): Vector2[] {
  if (startT <= 0 && endT >= 1) {
    return points.map(clonePoint);
  }

  const fromT = clampNumber(startT, 0, 1);
  const toT = clampNumber(endT, fromT, 1);
  let working = points.map(clonePoint);

  if (fromT > 0) {
    const splitAtStart = cubicSubdivide(working, fromT);

    working = splitAtStart[1];
  }

  if (toT < 1) {
    const localT = fromT >= 1 ? 0 : (toT - fromT) / (1 - fromT);
    const splitAtEnd = cubicSubdivide(working, localT);

    working = splitAtEnd[0];
  }

  return working;
}
