import { restoreTestState } from '../helpers/spies';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { cloneGeometry, hitPenCurve, splitPenSegment, type PenPathData } from '../../../../../../plugin-packages/editor-gizmo/src/2d/gizmos/shape/geometry';
import {
  Vector2,
  getBoxTransform,
  getBoxCorners,
  getTransformedBox,
  getTransformedBoxCorners,
  transformedBoxIntersectsBox,
  inverseTransformBoxPoint,
  transformedBoxContainsPoint,
} from '../../../../../../plugin-packages/editor-gizmo/src/math';

const { expect } = chai;

describe('plugin-editor-gizmo/geometry', () => {
  afterEach(restoreTestState);

  describe('Pen path geometry', () => {
    it('splits curves from JSON data while preserving existing anchors and handles', () => {
      const path: PenPathData = {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        easingIns: [{ x: 0, y: 0 }, { x: 0, y: 100 }],
        easingOuts: [{ x: 0, y: 100 }, { x: 0, y: 0 }],
        shapes: [{ close: false, indexes: [
          { point: 0, easingIn: 0, easingOut: 0 },
          { point: 1, easingIn: 1, easingOut: 1 },
        ] }],
      };
      const before = cloneGeometry(path);

      expect(splitPenSegment(path, 0, 0, 0.5)).to.equal(1);
      const [from, middle, to] = path.shapes[0].indexes;

      expect(path.points[middle.point]).to.deep.equal({ x: 50, y: 75 });
      expect(path.easingOuts[from.easingOut]).to.deep.equal({ x: 0, y: 50 });
      expect(path.easingIns[to.easingIn]).to.deep.equal({ x: 0, y: 50 });
      expect(path.easingIns[middle.easingIn]).to.deep.equal({ x: -25, y: 0 });
      expect(path.easingOuts[middle.easingOut]).to.deep.equal({ x: 25, y: 0 });
      expect(path.points.slice(0, 2)).to.deep.equal(before.points);
      expect(path.easingIns.slice(0, 2)).to.deep.equal(before.easingIns);
      expect(path.easingOuts.slice(0, 2)).to.deep.equal(before.easingOuts);
      for (const point of [...path.points, ...path.easingIns, ...path.easingOuts]) {
        expect(Object.getPrototypeOf(point)).to.equal(Object.prototype);
      }

      const restored = cloneGeometry(path);

      expect(splitPenSegment(restored, 0, 1, 0.5)).to.equal(2);
      expect(restored.points[restored.shapes[0].indexes[2].point]).to.deep.equal({ x: 84.375, y: 56.25 });
    });

    it('splits a plain path with missing handles without changing the next segment', () => {
      const path: PenPathData = {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
        easingIns: [],
        easingOuts: [],
        shapes: [{ close: false, indexes: [0, 1, 2].map(point => ({ point, easingIn: point, easingOut: point })) }],
      };
      const nextStart = path.shapes[0].indexes[1];

      expect(splitPenSegment(path, 0, 0, 0.25)).to.equal(1);
      expect(path.points[path.shapes[0].indexes[1].point]).to.deep.equal({ x: 15.625, y: 0 });
      expect(path.easingOuts[nextStart.easingOut] ?? { x: 0, y: 0 }).to.deep.equal({ x: 0, y: 0 });
    });

    it('handles collapsed curves with the same pixel hit threshold', () => {
      const controls: [Vector2, Vector2, Vector2, Vector2] = [
        new Vector2(5, 5), new Vector2(5, 5), new Vector2(5, 5), new Vector2(5, 5),
      ];
      const point = new Vector2(8, 9);

      expect(hitPenCurve(point, controls, 8)).to.deep.equal({ distance: 5, t: 0 });
      expect(hitPenCurve(point, controls, 5)).to.equal(undefined);
    });

    it('hits a loop with coincident endpoints without mutating input vectors', () => {
      const controls: [Vector2, Vector2, Vector2, Vector2] = [
        new Vector2(), new Vector2(100, 100), new Vector2(-100, 100), new Vector2(),
      ];
      const before = controls.map(point => point.toArray());
      const point = new Vector2(0, 75);
      const hit = hitPenCurve(point, controls, 8);

      expect(hit!.distance).to.be.lessThan(0.0001);
      expect(hit!.t).to.be.closeTo(0.5, 0.0001);
      expect(controls.map(value => value.toArray())).to.deep.equal(before);
      expect(point.toArray()).to.deep.equal([0, 75]);
    });
  });

  describe('Box2 geometry helpers', () => {
    it('derives independent corners from min/max without storing outline state on Box2', () => {
      const box = new Box2(new Vector2(10, 20), new Vector2(30, 50));
      const corners = getBoxCorners(box);

      expect(corners).to.deep.equal([
        new Vector2(10, 20),
        new Vector2(30, 20),
        new Vector2(30, 50),
        new Vector2(10, 50),
      ]);

      corners[0].set(-100, -100);
      expect(box.min).to.deep.equal(new Vector2(10, 20));
    });

    it('keeps an oriented outline separate from its axis-aligned range', () => {
      const center = new Vector2(100, 80);
      const source = getBoxCorners(new Box2(new Vector2(60, 60), new Vector2(140, 100)));
      const transform = getBoxTransform(source.map(point => point.clone().rotateAround(center, Math.PI / 4)))!;
      const range = getTransformedBox(transform);

      expect(range.containsPoint(new Vector2(70, 50))).to.equal(true);
      expect(transformedBoxContainsPoint(transform, new Vector2(70, 50))).to.equal(false);
      expect(transformedBoxContainsPoint(transform, center)).to.equal(true);
    });

    it('transforms normalized boxes through a two-dimensional affine matrix', () => {
      const transform = getBoxTransform([
        new Vector2(20, 10),
        new Vector2(120, 40),
        new Vector2(90, 140),
        new Vector2(-10, 110),
      ])!;
      const normalizedBox = new Box2(new Vector2(0.25, 0.2), new Vector2(0.75, 0.8));
      const points = getTransformedBoxCorners(transform, normalizedBox);

      expect(inverseTransformBoxPoint(transform, points[0])?.x).to.be.closeTo(normalizedBox.min.x, 0.5 * 10 ** -(2));
      expect(inverseTransformBoxPoint(transform, points[0])?.y).to.be.closeTo(normalizedBox.min.y, 0.5 * 10 ** -(2));
      expect(inverseTransformBoxPoint(transform, points[2])?.x).to.be.closeTo(normalizedBox.max.x, 0.5 * 10 ** -(2));
      expect(inverseTransformBoxPoint(transform, points[2])?.y).to.be.closeTo(normalizedBox.max.y, 0.5 * 10 ** -(2));
    });

    it('rejects degenerate projected points', () => {
      const point = new Vector2(5, 5);

      expect(getBoxTransform([point, point, point, point])).to.equal(undefined);
    });

    it('detects transformed box intersections without rotated AABB false positives', () => {
      const diamond = getBoxTransform([
        new Vector2(50, 0),
        new Vector2(100, 50),
        new Vector2(50, 100),
        new Vector2(0, 50),
      ])!;

      expect(transformedBoxIntersectsBox(
        diamond,
        new Box2(new Vector2(90, 40), new Vector2(110, 60)),
      )).to.equal(true);
      expect(transformedBoxIntersectsBox(
        diamond,
        new Box2(new Vector2(100, 40), new Vector2(110, 60)),
      )).to.equal(true);
      expect(transformedBoxIntersectsBox(
        diamond,
        new Box2(new Vector2(90, 0), new Vector2(110, 10)),
      )).to.equal(false);
    });
  });
});
