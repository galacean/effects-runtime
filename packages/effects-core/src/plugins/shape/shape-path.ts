/**
 * Based on:
 * https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/path/ShapePath.ts
 */

import type { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Polygon } from './polygon';
import { buildAdaptiveBezier } from './build-adaptive-bezier';
import type { GraphicsPath } from './graphics-path';

export class ShapePath {
  currentPoly: Polygon | null = null;
  shapePrimitives: { shape: Polygon, transform?: Matrix3 }[] = [];

  constructor (
    private graphicsPath: GraphicsPath,
  ) {
  }

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