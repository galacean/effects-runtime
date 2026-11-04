import type { CustomShape, ShapePathData } from '@galacean/effects-specification';
import { triangulate } from '../../math/shape/triangulate';
import type { GraphicsPath } from './graphics-path';
import type { ShapePath } from './shape-path';

export function appendBezierPaths (graphics: GraphicsPath, path: ShapePathData, screenScale = 1, closedOnly = false): void {
  for (const contour of path.shapes) {
    if (!closedOnly || contour.close) {
      appendBezierPath(graphics, path, contour, screenScale);
    }
  }
}

/** Appends a contour without imposing fill, stroke, material or ownership semantics. */
export function appendBezierPath (graphics: GraphicsPath, path: ShapePathData, contour: CustomShape, screenScale = 1): void {
  const { points, easingIns, easingOuts } = path;
  const { indexes, close } = contour;

  if (indexes.length === 0) {
    return;
  }
  const first = points[indexes[0].point];

  graphics.moveTo(first.x, first.y);
  const count = close ? indexes.length + 1 : indexes.length;

  for (let i = 1; i < count; i++) {
    const previousIndex = indexes[i - 1];
    const index = indexes[i % indexes.length];
    const previous = points[previousIndex.point];
    const point = points[index.point];
    const out = easingOuts[previousIndex.easingOut];
    const input = easingIns[index.easingIn];

    graphics.bezierCurveTo(
      previous.x + (out?.x ?? 0), previous.y + (out?.y ?? 0),
      point.x + (input?.x ?? 0), point.y + (input?.y ?? 0), point.x, point.y,
      undefined, screenScale,
    );
  }
  if (close) {
    graphics.closePath();
  }
}

export function buildPathContours (path: ShapePath, screenScale = 1) {
  return path.shapePrimitives.map(({ shape }) => {
    const points: number[] = [];

    shape.build(points, screenScale);

    return { shape, points };
  });
}

/** Separate fills retain primitive-specific triangulation; compound fills resolve holes across contours. */
export function buildPathGeometry (path: ShapePath, screenScale: number, fillMode: 'separate' | 'compound') {
  const contours = buildPathContours(path, screenScale);
  const indices: number[] = [];

  if (fillMode === 'compound') {
    // Compound coverage uses non-indexed triangles, with no degenerate bounds geometry.
    return { vertices: triangulate(contours.map(({ points }) => points)), indices };
  }
  const vertices: number[] = [];

  for (const { shape, points } of contours) {
    shape.triangulate(points, vertices, vertices.length / 2, indices, indices.length);
  }

  return { vertices, indices };
}
