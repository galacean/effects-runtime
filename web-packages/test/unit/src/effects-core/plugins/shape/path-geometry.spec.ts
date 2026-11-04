import type { spec } from '@galacean/effects';
import { GraphicsPath } from '../../../../../../../packages/effects-core/src/plugins/shape/graphics-path';
import { appendBezierPaths, buildPathGeometry } from '../../../../../../../packages/effects-core/src/plugins/shape/path-geometry';

const { expect } = chai;

function triangleArea (vertices: number[], indices: number[]): number {
  const order = indices.length ? indices : Array.from({ length: vertices.length / 2 }, (_, i) => i);
  let area = 0;

  for (let i = 0; i < order.length; i += 3) {
    const a = order[i] * 2;
    const b = order[i + 1] * 2;
    const c = order[i + 2] * 2;

    area += Math.abs((vertices[b] - vertices[a]) * (vertices[c + 1] - vertices[a + 1]) -
      (vertices[c] - vertices[a]) * (vertices[b + 1] - vertices[a + 1])) / 2;
  }

  return area;
}

function contour (path: GraphicsPath, left: number, bottom: number, right: number, top: number): void {
  path.moveTo(left, bottom).lineTo(right, bottom).lineTo(right, top).lineTo(left, top);
  path.closePath();
}

describe('core/plugins/shape/path-geometry', () => {
  it('preserves separate shape fills while compound masks cut holes and cancel overlaps', () => {
    const path = new GraphicsPath();

    contour(path, -2, -2, 2, 2);
    contour(path, -1, -1, 1, 1);
    const separate = buildPathGeometry(path.shapePath, 1, 'separate');
    const compound = buildPathGeometry(path.shapePath, 1, 'compound');

    expect(triangleArea(separate.vertices, separate.indices)).equals(20);
    expect(triangleArea(compound.vertices, compound.indices)).equals(12);
    path.clear();
    contour(path, 0, 0, 2, 2);
    contour(path, 1, 0, 3, 2);
    const overlapShape = buildPathGeometry(path.shapePath, 1, 'separate');
    const overlapMask = buildPathGeometry(path.shapePath, 1, 'compound');

    expect(triangleArea(overlapShape.vertices, overlapShape.indices)).equals(8);
    expect(triangleArea(overlapMask.vertices, overlapMask.indices)).equals(4);
  });

  it('keeps open shape paths available for drawing but excludes them from masks', () => {
    const data: spec.ShapePathData = {
      points: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 1 }],
      easingIns: [], easingOuts: [],
      shapes: [{ close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: point, easingOut: point })) }],
    };
    const shape = new GraphicsPath();
    const mask = new GraphicsPath();

    appendBezierPaths(shape, data);
    appendBezierPaths(mask, data, 1, true);
    const fill = buildPathGeometry(shape.shapePath, 1, 'separate');

    expect(triangleArea(fill.vertices, fill.indices)).equals(2);
    expect(buildPathGeometry(mask.shapePath, 1, 'compound').vertices).is.empty;
  });

  it('retains degenerate shape bounds without adding mask coverage', () => {
    const path = new GraphicsPath();

    path.moveTo(-2, 0).lineTo(0, 0).lineTo(3, 0);
    path.closePath();
    const shape = buildPathGeometry(path.shapePath, 1, 'separate');
    const xs = shape.vertices.filter((_, i) => i % 2 === 0);

    expect(Math.min(...xs)).equals(-2);
    expect(Math.max(...xs)).equals(3);
    expect(triangleArea(shape.vertices, shape.indices)).equals(0);
    expect(buildPathGeometry(path.shapePath, 1, 'compound').vertices).is.empty;
  });
});
