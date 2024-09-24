import { Polygon } from './polygon';
import { buildAdaptiveBezier } from './build-adaptive-bezier';

export class ShapePath {
  currentPoly: Polygon | null = null;

  controlPoint1X = 0;
  controlPoint1Y = -0.65;

  controlPoint2X = 1;
  controlPoint2Y = -0.05;

  /** Builds the path. */
  buildPath () {
    this.currentPoly = null;
    this.bezierCurveTo(this.controlPoint1X, this.controlPoint1Y, this.controlPoint2X, this.controlPoint2Y, 1, 1, 1);
    this.bezierCurveTo(1, 1.61, 1.41, 2, 2, 2, 1);
  }

  /**
   * Adds a cubic Bezier curve to the path.
   * It requires three points: the first two are control points and the third one is the end point.
   * The starting point is the last point in the current path.
   * @param cp1x - The x-coordinate of the first control point.
   * @param cp1y - The y-coordinate of the first control point.
   * @param cp2x - The x-coordinate of the second control point.
   * @param cp2y - The y-coordinate of the second control point.
   * @param x - The x-coordinate of the end point.
   * @param y - The y-coordinate of the end point.
   * @param smoothness - Optional parameter to adjust the smoothness of the curve.
   * @returns The instance of the current object for chaining.
   */
  bezierCurveTo (
    cp1x: number, cp1y: number, cp2x: number, cp2y: number,
    x: number, y: number,
    smoothness?: number
  ): this {
    this.ensurePoly();
    const currentPoly = this.currentPoly as Polygon;

    buildAdaptiveBezier(
      currentPoly.points,
      currentPoly.lastX, currentPoly.lastY,
      cp1x, cp1y, cp2x, cp2y, x, y,
      smoothness,
    );

    return this;
  }

  private ensurePoly (start = true): void {
    if (this.currentPoly) {return;}

    this.currentPoly = new Polygon();
    this.currentPoly.points.push(0, 0);

  }
}
