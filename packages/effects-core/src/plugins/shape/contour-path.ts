import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { GraphicsPath } from './graphics-path';
import { Polygon } from '../../math/shape/polygon';
import type { ShapePath } from './shape-path';

export type ContourPathCommand =
  | { action: 'moveTo', data: [Vector2] }
  | { action: 'lineTo', data: [Vector2] }
  | { action: 'bezierCurveTo', data: [Vector2, Vector2, Vector2], smoothness?: number, scale?: number }
  | { action: 'closePath', data: [] };

function addMove (path: ContourPathCommand[], point: Vector2): void {
  path.push({ action: 'moveTo', data: [point] });
}

function addLine (path: ContourPathCommand[], point: Vector2): void {
  path.push({ action: 'lineTo', data: [point] });
}

function addCubic (
  path: ContourPathCommand[],
  controlPoint1: Vector2,
  controlPoint2: Vector2,
  endPoint: Vector2,
  smoothness?: number,
  scale?: number,
): void {
  path.push({ action: 'bezierCurveTo', data: [controlPoint1, controlPoint2, endPoint], smoothness, scale });
}

function addClose (path: ContourPathCommand[]): void {
  path.push({ action: 'closePath', data: [] });
}

const tempPoint = new Vector3();

function transformPoints (points: number[], transform?: Matrix4): number[] {
  if (!transform) {
    return points.slice();
  }

  const transformed = new Array<number>(points.length);

  for (let index = 0; index < points.length; index += 2) {
    tempPoint.set(points[index], points[index + 1], 0);
    const out = transform.transformPoint(tempPoint, tempPoint);

    transformed[index] = out.x;
    transformed[index + 1] = out.y;
  }

  return transformed;
}

function appendPolyline (path: ContourPathCommand[], points: number[], closePath: boolean): void {
  if (points.length < 2) {
    return;
  }

  addMove(path, new Vector2(points[0], points[1]));

  for (let index = 2; index < points.length; index += 2) {
    addLine(path, new Vector2(points[index], points[index + 1]));
  }

  if (closePath) {
    addClose(path);
  }
}

export function tryMakeContourPathFromGraphicsPath (source: GraphicsPath): ContourPathCommand[] | null {
  const contourPath: ContourPathCommand[] = [];

  for (const instruction of source.instructions) {
    const data = instruction.data;

    switch (instruction.action) {
      case 'moveTo':
        addMove(contourPath, new Vector2(data[0], data[1]));

        break;
      case 'lineTo':
        addLine(contourPath, new Vector2(data[0], data[1]));

        break;
      case 'bezierCurveTo':
        addCubic(
          contourPath,
          new Vector2(data[0], data[1]),
          new Vector2(data[2], data[3]),
          new Vector2(data[4], data[5]),
          data[6] as number | undefined,
          data[7] as number | undefined,
        );

        break;
      case 'closePath':
        addClose(contourPath);

        break;
      default:
        return null;
    }
  }

  return contourPath;
}

export function makeContourPathFromShapePath (shapePath: ShapePath, screenScale: number): ContourPathCommand[] {
  const contourPath: ContourPathCommand[] = [];

  for (const { shape, transform } of shapePath.shapePrimitives) {
    const points = shape instanceof Polygon
      ? shape.points.slice()
      : (() => {
        const builtPoints: number[] = [];

        shape.build(builtPoints, screenScale);

        return builtPoints;
      })();

    appendPolyline(contourPath, transformPoints(points, transform), shape instanceof Polygon ? shape.closePath : true);
  }

  return contourPath;
}