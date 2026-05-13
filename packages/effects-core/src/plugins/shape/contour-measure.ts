import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { buildAdaptiveBezier } from '../../math/shape/build-adaptive-bezier';
import type { GraphicsPath } from './graphics-path';
import { clampNumber, clonePoint, cubicExtract, cubicPointAt, lineExtract, lerpNumber, normalizeVector2, pointsEqual } from './contour-path-utils';
import type { ContourPathCommand } from './contour-path';
import { tryMakeContourPathFromGraphicsPath, makeContourPathFromShapePath } from './contour-path';

export type ContourMeasureSegmentType = 'line' | 'cubic';

export type ContourMeasureSegment = {
  distance: number,
  pointIndex: number,
  tValue: number,
  type: ContourMeasureSegmentType,
  smoothness?: number,
  scale?: number,
};

export type ContourMeasurePosTan = {
  pos: Vector2,
  tan: Vector2,
};

type ContourDataSegment = {
  distance: number,
  pointIndex: number,
  tValue: number,
  type: 'line' | 'cubic',
  smoothness?: number,
  scale?: number,
};

type ContourCurve = {
  points: Vector2[],
  segments: ContourDataSegment[],
  closePath: boolean,
};

type ContourMeasureData = {
  points: Vector2[],
  segments: ContourDataSegment[],
  contourLength: number,
  contourClosed: boolean,
};

type ContourBuildResult = {
  contour: ContourCurve | null,
  nextIndex: number,
};

function addLineSeg (
  points: Vector2[],
  segments: ContourDataSegment[],
  target: Vector2,
  distance: number,
): number {
  if (points.length === 0) {
    points.push(clonePoint(target));

    return distance;
  }

  const start = points[points.length - 1];
  const segmentLength = Math.hypot(target.x - start.x, target.y - start.y);

  if (segmentLength <= Number.EPSILON) {
    return distance;
  }

  const pointIndex = points.length - 1;

  points.push(clonePoint(target));
  distance += segmentLength;
  segments.push({
    distance,
    pointIndex,
    tValue: 1,
    type: 'line',
  });

  return distance;
}

function addCubicSegs (
  curvePoints: Vector2[],
  pointIndex: number,
  distance: number,
  sourcePoints: readonly Vector2[],
  screenScale: number,
  tolerance: number,
  smoothness?: number,
  scale?: number,
): { distance: number, segments: ContourDataSegment[] } {
  const samplePoints: number[] = [];
  const tValues: number[] = [];

  buildAdaptiveBezier(
    samplePoints,
    sourcePoints[0].x,
    sourcePoints[0].y,
    sourcePoints[1].x,
    sourcePoints[1].y,
    sourcePoints[2].x,
    sourcePoints[2].y,
    sourcePoints[3].x,
    sourcePoints[3].y,
    smoothness ?? tolerance,
    scale ?? screenScale,
    tValues,
  );
  const segments: ContourDataSegment[] = [];
  let previousPoint = sourcePoints[0];

  for (let index = 0; index < tValues.length; index++) {
    const tValue = tValues[index];
    const pointOffset = index * 2;
    const nextPoint = tValue >= 1
      ? sourcePoints[3]
      : new Vector2(samplePoints[pointOffset], samplePoints[pointOffset + 1]);
    const segmentLength = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);

    if (segmentLength > Number.EPSILON) {
      distance += segmentLength;
      segments.push({
        distance,
        pointIndex,
        tValue,
        type: 'cubic',
        smoothness,
        scale,
      });
      previousPoint = nextPoint;
    }
  }

  if (segments.length === 0) {
    return { distance, segments };
  }

  curvePoints.push(clonePoint(sourcePoints[1]), clonePoint(sourcePoints[2]), clonePoint(sourcePoints[3]));

  return { distance, segments };
}

function finishContourCurve (
  points: Vector2[],
  segments: ContourDataSegment[],
  distance: number,
  closePath: boolean,
): ContourCurve | null {
  if (segments.length === 0 || points.length < 2 || distance <= Number.EPSILON) {
    return null;
  }

  return {
    points,
    segments,
    closePath,
  };
}

function tryNextContour (
  source: ContourPathCommand[],
  startIndex: number,
  screenScale: number,
  tolerance: number,
): ContourBuildResult {
  let currentPoints: Vector2[] = [];
  let currentSegments: ContourDataSegment[] = [];
  let currentDistance = 0;
  let contourStart: Vector2 | null = null;
  let isClosed = false;

  const ensureContour = (): void => {
    if (currentPoints.length === 0) {
      const startPoint = contourStart ?? new Vector2(0, 0);

      currentPoints.push(clonePoint(startPoint));
      contourStart = clonePoint(startPoint);
    }
  };

  for (let commandIndex = startIndex; commandIndex < source.length; commandIndex++) {
    const command = source[commandIndex];

    switch (command.action) {
      case 'moveTo': {
        const contour = finishContourCurve(currentPoints, currentSegments, currentDistance, isClosed);

        if (contour) {
          return {
            contour,
            nextIndex: commandIndex,
          };
        }

        currentPoints = [];
        currentSegments = [];
        currentDistance = 0;
        contourStart = clonePoint(command.data[0]);
        isClosed = false;
        currentPoints.push(clonePoint(contourStart));

        break;
      }
      case 'lineTo': {
        ensureContour();
        currentDistance = addLineSeg(currentPoints, currentSegments, command.data[0], currentDistance);

        break;
      }
      case 'bezierCurveTo': {
        ensureContour();

        const start = currentPoints[currentPoints.length - 1];
        const pointIndex = currentPoints.length - 1;
        const [controlPoint1, controlPoint2, endPoint] = command.data;
        const cubic = addCubicSegs(
          currentPoints,
          pointIndex,
          currentDistance,
          [
            clonePoint(start),
            clonePoint(controlPoint1),
            clonePoint(controlPoint2),
            clonePoint(endPoint),
          ],
          screenScale,
          tolerance,
          command.smoothness,
          command.scale,
        );

        currentDistance = cubic.distance;
        currentSegments.push(...cubic.segments);

        break;
      }
      case 'closePath': {
        if (currentPoints.length > 0 && contourStart) {
          currentDistance = addLineSeg(currentPoints, currentSegments, contourStart, currentDistance);
          isClosed = true;
        }

        const contour = finishContourCurve(currentPoints, currentSegments, currentDistance, isClosed);

        if (contour) {
          return {
            contour,
            nextIndex: commandIndex + 1,
          };
        }

        currentPoints = [];
        currentSegments = [];
        currentDistance = 0;
        contourStart = null;
        isClosed = false;

        break;
      }
    }
  }

  return {
    contour: finishContourCurve(currentPoints, currentSegments, currentDistance, isClosed),
    nextIndex: source.length,
  };
}

function resolveContourPath (source: GraphicsPath, screenScale: number): ContourPathCommand[] {
  return tryMakeContourPathFromGraphicsPath(source) ?? makeContourPathFromShapePath(source.shapePath, screenScale);
}

function makeMeasureDataFromCurve (curve: ContourCurve): ContourMeasureData | null {
  if (curve.points.length < 2 || curve.segments.length === 0) {
    return null;
  }

  const contourLength = curve.segments[curve.segments.length - 1].distance;

  if (contourLength <= Number.EPSILON) {
    return null;
  }

  return {
    points: curve.points,
    segments: curve.segments,
    contourLength,
    contourClosed: curve.closePath,
  };
}

function nextSegmentBeginning (segments: readonly ContourMeasureSegment[], index: number): number {
  const pointIndex = segments[index].pointIndex;
  let nextIndex = index + 1;

  while (nextIndex < segments.length && segments[nextIndex].pointIndex === pointIndex) {
    nextIndex++;
  }

  return nextIndex;
}

function linePointsForSegment (points: readonly Vector2[], pointIndex: number): [Vector2, Vector2] {
  return [points[pointIndex], points[pointIndex + 1]];
}

function cubicPointsForSegment (points: readonly Vector2[], pointIndex: number): [Vector2, Vector2, Vector2, Vector2] {
  return [points[pointIndex], points[pointIndex + 1], points[pointIndex + 2], points[pointIndex + 3]];
}

function evalCubic (points: readonly Vector2[], t: number): ContourMeasurePosTan {
  if (t <= 0) {
    const tangentPoint = !pointsEqual(points[0], points[1])
      ? points[1]
      : !pointsEqual(points[1], points[2])
        ? points[2]
        : points[3];

    return {
      pos: new Vector2(points[0].x, points[0].y),
      tan: normalizeVector2(tangentPoint.x - points[0].x, tangentPoint.y - points[0].y),
    };
  }

  if (t >= 1) {
    const tangentPoint = !pointsEqual(points[3], points[2])
      ? points[2]
      : !pointsEqual(points[2], points[1])
        ? points[1]
        : points[0];

    return {
      pos: new Vector2(points[3].x, points[3].y),
      tan: normalizeVector2(points[3].x - tangentPoint.x, points[3].y - tangentPoint.y),
    };
  }

  const tangentDelta = 0.0001;
  const prevPoint = cubicPointAt(points, Math.max(0, t - tangentDelta));
  const nextPoint = cubicPointAt(points, Math.min(1, t + tangentDelta));

  return {
    pos: cubicPointAt(points, t),
    tan: normalizeVector2(nextPoint.x - prevPoint.x, nextPoint.y - prevPoint.y),
  };
}

function evalLine (points: readonly Vector2[], t: number): ContourMeasurePosTan {
  const pos = lineExtract(points, t, t)[0];

  return {
    pos,
    tan: normalizeVector2(points[1].x - points[0].x, points[1].y - points[0].y),
  };
}

export class ContourMeasure {
  constructor (
    private readonly segments: ContourMeasureSegment[],
    private readonly points: Vector2[],
    private readonly contourLength: number,
    private readonly contourClosed: boolean,
  ) {}

  length (): number {
    return this.contourLength;
  }

  isClosed (): boolean {
    return this.contourClosed;
  }

  getPosTan (distance: number): ContourMeasurePosTan {
    if (this.segments.length === 0) {
      return {
        pos: new Vector2(),
        tan: new Vector2(1, 0),
      };
    }

    const clampedDistance = clampNumber(distance, 0, this.contourLength);
    const segmentIndex = this.findSegment(clampedDistance);
    const segment = this.segments[segmentIndex];
    const prevDistance = segmentIndex > 0 ? this.segments[segmentIndex - 1].distance : 0;
    const segmentLength = segment.distance - prevDistance;
    const distanceRatio = segmentLength <= Number.EPSILON ? 0 : (clampedDistance - prevDistance) / segmentLength;

    if (segment.type === 'line') {
      return evalLine(linePointsForSegment(this.points, segment.pointIndex), distanceRatio);
    }

    const prevSegment = segmentIndex > 0 ? this.segments[segmentIndex - 1] : undefined;
    const prevT = prevSegment && prevSegment.pointIndex === segment.pointIndex ? prevSegment.tValue : 0;
    const t = lerpNumber(prevT, segment.tValue, distanceRatio);

    return evalCubic(cubicPointsForSegment(this.points, segment.pointIndex), t);
  }

  getSegment (
    startDistance: number,
    endDistance: number,
    destination: GraphicsPath,
    startWithMove: boolean,
  ): void {
    const clampedStart = clampNumber(startDistance, 0, this.contourLength);
    const clampedEnd = clampNumber(endDistance, 0, this.contourLength);

    if (clampedStart >= clampedEnd || this.segments.length === 0) {
      return;
    }

    let startIndex = this.findSegment(clampedStart);
    const endIndex = this.findSegment(clampedEnd);
    let startSegment = this.segments[startIndex];
    const endSegment = this.segments[endIndex];
    let startT = this.computeT(startIndex, clampedStart);
    const endT = this.computeT(endIndex, clampedEnd);

    if (1 - startT < Number.EPSILON && startIndex < endIndex) {
      startIndex++;
      startSegment = this.segments[startIndex];
      startT = 0;
    }

    if (startSegment.pointIndex === endSegment.pointIndex) {
      this.extractSegment(startIndex, startT, endT, destination, startWithMove);

      return;
    }

    this.extractSegment(startIndex, startT, 1, destination, startWithMove);

    let segmentIndex = nextSegmentBeginning(this.segments, startIndex);

    while (segmentIndex < this.segments.length && this.segments[segmentIndex].pointIndex !== endSegment.pointIndex) {
      this.extractWholeSegment(segmentIndex, destination);
      segmentIndex = nextSegmentBeginning(this.segments, segmentIndex);
    }

    this.extractSegment(endIndex, 0, endT, destination, false);
  }

  warp (source: Vector2): Vector2 {
    const result = this.getPosTan(source.x);

    return new Vector2(
      result.pos.x - result.tan.y * source.y,
      result.pos.y + result.tan.x * source.y,
    );
  }

  dump (): void {
    // eslint-disable-next-line no-console
    console.log('ContourMeasure', {
      length: this.contourLength,
      points: this.points.length,
      segments: this.segments.length,
      isClosed: this.contourClosed,
    });
  }

  private findSegment (distance: number): number {
    let low = 0;
    let high = this.segments.length - 1;

    while (low < high) {
      const middle = (low + high) >> 1;

      if (this.segments[middle].distance < distance) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  private computeT (segmentIndex: number, distance: number): number {
    const segment = this.segments[segmentIndex];
    const prevSegment = segmentIndex > 0 ? this.segments[segmentIndex - 1] : undefined;
    const prevDistance = prevSegment ? prevSegment.distance : 0;
    const prevT = prevSegment && prevSegment.pointIndex === segment.pointIndex ? prevSegment.tValue : 0;
    const ratio = segment.distance <= prevDistance ? 0 : (distance - prevDistance) / (segment.distance - prevDistance);

    return clampNumber(lerpNumber(prevT, segment.tValue, ratio), prevT, segment.tValue);
  }

  private extractWholeSegment (segmentIndex: number, destination: GraphicsPath): void {
    const segment = this.segments[segmentIndex];

    if (segment.type === 'line') {
      const [, end] = linePointsForSegment(this.points, segment.pointIndex);

      destination.lineTo(end.x, end.y);

      return;
    }

    const [, cp1, cp2, end] = cubicPointsForSegment(this.points, segment.pointIndex);

    destination.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y, segment.smoothness, segment.scale);
  }

  private extractSegment (
    segmentIndex: number,
    startT: number,
    endT: number,
    destination: GraphicsPath,
    moveTo: boolean,
  ): void {
    const segment = this.segments[segmentIndex];

    if (segment.type === 'line') {
      const [start, end] = linePointsForSegment(this.points, segment.pointIndex);
      const extractedStart = new Vector2(lerpNumber(start.x, end.x, startT), lerpNumber(start.y, end.y, startT));
      const extractedEnd = new Vector2(lerpNumber(start.x, end.x, endT), lerpNumber(start.y, end.y, endT));

      if (moveTo) {
        destination.moveTo(extractedStart.x, extractedStart.y);
      }

      destination.lineTo(extractedEnd.x, extractedEnd.y);

      return;
    }

    const cubic = cubicExtract(cubicPointsForSegment(this.points, segment.pointIndex), startT, endT);

    if (moveTo) {
      destination.moveTo(cubic[0].x, cubic[0].y);
    }

    destination.bezierCurveTo(cubic[1].x, cubic[1].y, cubic[2].x, cubic[2].y, cubic[3].x, cubic[3].y, segment.smoothness, segment.scale);
  }
}

export class ContourMeasureIter {
  static readonly defaultTolerance = 0.5;

  private contourPath: ContourPathCommand[] = [];
  private cursor = 0;
  private screenScale = 1;

  constructor (source: GraphicsPath, screenScale = 1) {
    this.rewind(source, screenScale);
  }

  rewind (source: GraphicsPath, screenScale = 1): void {
    this.contourPath = resolveContourPath(source, screenScale);
    this.screenScale = screenScale;
    this.cursor = 0;
  }

  private tryNext (): ContourMeasure | null {
    const result = tryNextContour(this.contourPath, this.cursor, this.screenScale, ContourMeasureIter.defaultTolerance);

    this.cursor = result.nextIndex;

    const measure = result.contour ? makeMeasureDataFromCurve(result.contour) : null;

    if (!measure) {
      return null;
    }

    return new ContourMeasure(
      measure.segments,
      measure.points,
      measure.contourLength,
      measure.contourClosed,
    );
  }

  next (): ContourMeasure | null {
    while (this.cursor < this.contourPath.length) {
      const contour = this.tryNext();

      if (contour) {
        return contour;
      }
    }

    return null;
  }

  toArray (): ContourMeasure[] {
    const savedCursor = this.cursor;
    const contours: ContourMeasure[] = [];
    let contour: ContourMeasure | null;

    while ((contour = this.next())) {
      contours.push(contour);
    }

    this.cursor = savedCursor;

    return contours;
  }
}