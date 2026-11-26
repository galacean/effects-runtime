import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { CustomShape, MaskPathData, TransformData } from '@galacean/effects-specification';
import { triangulate } from '../../math/shape/triangulate';
import { Transform } from '../../transform';
import { GraphicsPath } from './graphics-path';
import { makeStrokeContourPath } from './contour-path';
import type { ShapePath } from './shape-path';

/** @internal */
export function appendBezierPaths (graphics: GraphicsPath, path: MaskPathData, screenScale = 1, closedOnly = false): void {
  for (const contour of path.shapes) {
    if (!closedOnly || contour.close) {
      appendBezierPath(graphics, path, contour, screenScale);
    }
  }
}

/**
 * 按轮廓索引追加贝塞尔路径，控制柄使用相对顶点的偏移量。
 * @internal
 */
export function appendBezierPath (graphics: GraphicsPath, path: MaskPathData, contour: CustomShape, screenScale = 1): void {
  const { points, easingIns, easingOuts } = path;
  const { indexes, close } = contour;

  if (indexes.length === 0) {
    return;
  }
  const first = points[indexes[0].point];
  const target = contour.transform ? new GraphicsPath() : graphics;

  target.moveTo(first.x, first.y);
  const count = close ? indexes.length + 1 : indexes.length;

  for (let i = 1; i < count; i++) {
    const previousIndex = indexes[i - 1];
    const index = indexes[i % indexes.length];
    const previous = points[previousIndex.point];
    const point = points[index.point];
    const out = easingOuts[previousIndex.easingOut];
    const input = easingIns[index.easingIn];

    target.bezierCurveTo(
      previous.x + (out?.x ?? 0), previous.y + (out?.y ?? 0),
      point.x + (input?.x ?? 0), point.y + (input?.y ?? 0), point.x, point.y,
      undefined, screenScale,
    );
  }
  if (close) {
    target.closePath();
  }
  if (contour.transform) {
    appendTransformedPath(graphics, target, contour.transform);
  }
}

/** @internal */
export function appendTransformedPath (graphics: GraphicsPath, path: GraphicsPath, data: TransformData): void {
  const commands = makeStrokeContourPath(path);
  const transform = new Transform();

  transform.fromData(data);
  transform.setScale(transform.scale.x * (data.size?.x ?? 1), transform.scale.y * (data.size?.y ?? 1), transform.scale.z);
  const matrix = transform.getMatrix();
  const point = new Vector3();

  if (path === graphics) {
    graphics.clear();
  }
  for (const command of commands) {
    for (const control of command.data) {
      point.set(control.x, control.y, 0);
      matrix.transformPoint(point, point); control.set(point.x, point.y);
    }
    switch (command.action) {
      case 'moveTo':
        graphics.moveTo(command.data[0].x, command.data[0].y);

        break;
      case 'lineTo':
        graphics.lineTo(command.data[0].x, command.data[0].y);

        break;
      case 'bezierCurveTo':
        graphics.bezierCurveTo(command.data[0].x, command.data[0].y, command.data[1].x, command.data[1].y,
          command.data[2].x, command.data[2].y, command.smoothness, command.scale);

        break;
      case 'closePath':
        graphics.closePath();

        break;
    }
  }
}

/** @internal */
export function buildPathContours (path: ShapePath, screenScale = 1) {
  return path.shapePrimitives.map(({ shape }) => {
    const points: number[] = [];

    shape.build(points, screenScale);

    return { shape, points };
  });
}

/**
 * separate 按各形状的算法独立三角化；compound 按奇偶规则处理多轮廓与孔洞。
 * compound 返回无索引三角形。
 * @internal
 */
export function buildPathGeometry (path: ShapePath, screenScale: number, fillMode: 'separate' | 'compound') {
  const contours = buildPathContours(path, screenScale);
  const indices: number[] = [];

  if (fillMode === 'compound') {
    return { vertices: triangulate(contours.map(({ points }) => points)), indices };
  }
  const vertices: number[] = [];

  for (const { shape, points } of contours) {
    shape.triangulate(points, vertices, vertices.length / 2, indices, indices.length);
  }

  return { vertices, indices };
}
