import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { GraphicsPath } from './graphics-path';
import { PolyStar } from '../../math/shape/poly-star';

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

/** Preserve cubic segments for stroke expansion, including the built-in shape primitives. */
export function makeStrokeContourPath (source: GraphicsPath): ContourPathCommand[] {
  const path: ContourPathCommand[] = [];
  const k = 0.5522847498307933;

  for (const instruction of source.instructions) {
    const data = instruction.data;
    const begin = path.length;
    let transform: Matrix4 | undefined;

    switch (instruction.action) {
      case 'moveTo':
        addMove(path, new Vector2(data[0], data[1]));

        break;
      case 'lineTo':
        addLine(path, new Vector2(data[0], data[1]));

        break;
      case 'bezierCurveTo':
        addCubic(path, new Vector2(data[0], data[1]), new Vector2(data[2], data[3]), new Vector2(data[4], data[5]), data[6], data[7]);

        break;
      case 'closePath':
        addClose(path);

        break;
      case 'circle':
      case 'ellipse': {
        const [x, y, rx] = data as number[];
        const ry = instruction.action === 'circle' ? rx : data[3] as number;

        transform = data[instruction.action === 'circle' ? 3 : 4] as Matrix4 | undefined;
        if (!(rx >= 0 && ry >= 0) || rx + ry === 0) {
          continue;
        }
        addMove(path, new Vector2(x + rx, y));
        addCubic(path, new Vector2(x + rx, y + k * ry), new Vector2(x + k * rx, y + ry), new Vector2(x, y + ry));
        addCubic(path, new Vector2(x - k * rx, y + ry), new Vector2(x - rx, y + k * ry), new Vector2(x - rx, y));
        addCubic(path, new Vector2(x - rx, y - k * ry), new Vector2(x - k * rx, y - ry), new Vector2(x, y - ry));
        addCubic(path, new Vector2(x + k * rx, y - ry), new Vector2(x + rx, y - k * ry), new Vector2(x + rx, y));
        addClose(path);

        break;
      }
      case 'rect': {
        const [x, y, width, height, roundness] = data as number[];
        const r = Math.max(0, Math.min(roundness / 100, 1) * Math.min(width, height) * 0.5);

        transform = data[5] as Matrix4 | undefined;
        if (!(width >= 0 && height >= 0)) {
          continue;
        }
        const right = x + width;
        const top = y + height;

        // Match Rectangle.build's contour origin so authored trim ranges stay on the same edges.
        if (r === 0) {
          appendPolyline(path, [right, top, x, top, x, y, right, y], true);
        } else {
          addMove(path, new Vector2(right, top - r));
          addCubic(path, new Vector2(right, top - r + k * r), new Vector2(right - r + k * r, top), new Vector2(right - r, top));
          addLine(path, new Vector2(x + r, top));
          addCubic(path, new Vector2(x + r - k * r, top), new Vector2(x, top - r + k * r), new Vector2(x, top - r));
          addLine(path, new Vector2(x, y + r));
          addCubic(path, new Vector2(x, y + r - k * r), new Vector2(x + r - k * r, y), new Vector2(x + r, y));
          addLine(path, new Vector2(right - r, y));
          addCubic(path, new Vector2(right - r + k * r, y), new Vector2(right, y + r - k * r), new Vector2(right, y + r));
          addLine(path, new Vector2(right, top - r));
          addClose(path);
        }

        break;
      }
      case 'triangle':
        appendPolyline(path, data.slice(0, 6) as number[], true);
        transform = data[6] as Matrix4 | undefined;

        break;
      case 'polyStar': {
        const shape = new PolyStar(data[0], data[1], data[2], data[3], data[4], data[5]);
        const { vertices, inTangents, outTangents } = shape.getBezierPath();

        transform = data[6] as Matrix4 | undefined;
        if (vertices.length < 4) {
          continue;
        }
        addMove(path, new Vector2(vertices[0], vertices[1]));
        for (let i = 0; i < vertices.length; i += 2) {
          const next = (i + 2) % vertices.length;

          addCubic(path, new Vector2(outTangents[i], outTangents[i + 1]), new Vector2(inTangents[next], inTangents[next + 1]), new Vector2(vertices[next], vertices[next + 1]));
        }
        addClose(path);

        break;
      }
    }
    if (transform) {
      for (let i = begin; i < path.length; i++) {
        for (const point of path[i].data) {
          tempPoint.set(point.x, point.y, 0);
          transform.transformPoint(tempPoint, tempPoint);
          point.set(tempPoint.x, tempPoint.y);
        }
      }
    }
  }

  return path;
}
