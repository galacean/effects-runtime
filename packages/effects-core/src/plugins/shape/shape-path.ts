// Based on:
// https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/path/ShapePath.ts

import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Polygon } from './polygon';
import { buildAdaptiveBezier } from './build-adaptive-bezier';
import type { GraphicsPath } from './graphics-path';
import type { ShapePrimitive } from './shape-primitive';
import { Ellipse } from './ellipse';
import type { StarType } from './poly-star';
import { PolyStar } from './poly-star';
import { Rectangle } from './rectangle';

export class ShapePath {
  currentPoly: Polygon | null = null;
  shapePrimitives: { shape: ShapePrimitive, transform?: Matrix4 }[] = [];

  constructor (
    private graphicsPath: GraphicsPath,
  ) { }

  /** Builds the path. */
  buildPath () {
    this.currentPoly = null;
    this.shapePrimitives.length = 0;
    const path = this.graphicsPath;

    for (const instruction of path.instructions) {
      const action = instruction.action;
      const data = instruction.data;

      switch (action) {
        case 'bezierCurveTo': {
          this.bezierCurveTo(data[0], data[1], data[2], data[3], data[4], data[5], data[6]);

          break;
        }
        case 'moveTo': {
          this.moveTo(data[0], data[1]);

          break;
        }
        case 'ellipse': {
          this.ellipse(data[0], data[1], data[2], data[3], data[4]);

          break;
        }
        case 'polyStar': {
          this.polyStar(data[0], data[1], data[2], data[3], data[4], data[5], data[6]);

          break;
        }
        case 'rect': {
          this.rect(data[0], data[1], data[2], data[3], data[4]);

          break;
        }
        case 'closePath':{
          this.closePath();

          break;
        }
      }
    }
    this.endPoly();
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
    smoothness?: number,
  ): ShapePath {
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

  moveTo (x: number, y: number): ShapePath {
    this.startPoly(x, y);

    return this;
  }

  /**
   * Closes the current path by drawing a straight line back to the start.
   * If the shape is already closed or there are no points in the path, this method does nothing.
   * @returns The instance of the current object for chaining.
   */
  closePath (): this {
    this.endPoly(true);

    return this;
  }

  /**
   * Draws an ellipse at the specified location and with the given x and y radii.
   * An optional transformation can be applied, allowing for rotation, scaling, and translation.
   * @param x - The x-coordinate of the center of the ellipse.
   * @param y - The y-coordinate of the center of the ellipse.
   * @param radiusX - The horizontal radius of the ellipse.
   * @param radiusY - The vertical radius of the ellipse.
   * @param transform - An optional `Matrix` object to apply a transformation to the ellipse. This can include rotations.
   * @returns The instance of the current object for chaining.
   */
  ellipse (x: number, y: number, radiusX: number, radiusY: number, transform?: Matrix4): this {
    // TODO apply rotation to transform...

    this.drawShape(new Ellipse(x, y, radiusX, radiusY), transform);

    return this;
  }

  polyStar (pointCount: number, outerRadius: number, innerRadius: number, outerRoundness: number, innerRoundness: number, starType: StarType, transform?: Matrix4) {
    this.drawShape(new PolyStar(pointCount, outerRadius, innerRadius, outerRoundness, innerRoundness, starType), transform);

    return this;
  }

  /**
   * Draws a rectangle shape. This method adds a new rectangle path to the current drawing.
   * @param x - The x-coordinate of the upper-left corner of the rectangle.
   * @param y - The y-coordinate of the upper-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param transform - An optional `Matrix` object to apply a transformation to the rectangle.
   * @returns The instance of the current object for chaining.
   */
  rect (x: number, y: number, w: number, h: number, roundness: number, transform?: Matrix4): this {
    this.drawShape(new Rectangle(x, y, w, h, roundness), transform);

    return this;
  }

  /**
   * Draws a given shape on the canvas.
   * This is a generic method that can draw any type of shape specified by the `ShapePrimitive` parameter.
   * An optional transformation matrix can be applied to the shape, allowing for complex transformations.
   * @param shape - The shape to draw, defined as a `ShapePrimitive` object.
   * @param matrix - An optional `Matrix` for transforming the shape. This can include rotations,
   * scaling, and translations.
   * @returns The instance of the current object for chaining.
   */
  drawShape (shape: ShapePrimitive, matrix?: Matrix4): this {
    this.endPoly();

    this.shapePrimitives.push({ shape, transform: matrix });

    return this;
  }

  /**
   * Starts a new polygon path from the specified starting point.
   * This method initializes a new polygon or ends the current one if it exists.
   * @param x - The x-coordinate of the starting point of the new polygon.
   * @param y - The y-coordinate of the starting point of the new polygon.
   * @returns The instance of the current object for chaining.
   */
  private startPoly (x: number, y: number): this {
    let currentPoly = this.currentPoly;

    if (currentPoly) {
      this.endPoly();
    }

    currentPoly = new Polygon();

    currentPoly.points.push(x, y);

    this.currentPoly = currentPoly;

    return this;
  }

  /**
   * Ends the current polygon path. If `closePath` is set to true,
   * the path is closed by connecting the last point to the first one.
   * This method finalizes the current polygon and prepares it for drawing or adding to the shape primitives.
   * @param closePath - A boolean indicating whether to close the polygon by connecting the last point
   *  back to the starting point. False by default.
   * @returns The instance of the current object for chaining.
   */
  private endPoly (closePath = false): this {
    const shape = this.currentPoly;

    if (shape && shape.points.length > 2) {
      shape.closePath = closePath;

      this.shapePrimitives.push({ shape });
    }

    this.currentPoly = null;

    return this;
  }

  private ensurePoly (start = true): void {
    if (this.currentPoly) { return; }

    this.currentPoly = new Polygon();
    this.currentPoly.points.push(0, 0);
  }
}
