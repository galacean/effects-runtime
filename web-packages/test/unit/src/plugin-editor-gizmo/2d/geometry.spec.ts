import { restoreTestState } from '../helpers/spies';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import {
  Vector2,
  getBoxTransform,
  getBoxCorners,
  getTransformedBox,
  getTransformedBoxCorners,
  transformedBoxIntersectsBox,
  inverseTransformBoxPoint,
  transformedBoxContainsPoint,
} from '../../../../../../plugin-packages/editor-gizmo/src/2d/math';

const { expect } = chai;

describe('plugin-editor-gizmo/geometry', () => {
  afterEach(restoreTestState);

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
