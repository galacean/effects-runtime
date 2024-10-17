/**
 * Based on:
 * https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/path/GraphicsPath.ts
 */

import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { ShapePath } from './shape-path';

export class GraphicsPath {
  instructions: PathInstruction[] = [];

  private dirty = false;
  private _shapePath: ShapePath;

  /**
   * Provides access to the internal shape path, ensuring it is up-to-date with the current instructions.
   * @returns The `ShapePath` instance associated with this `GraphicsPath`.
   */
  get shapePath (): ShapePath {
    if (!this._shapePath) {
      this._shapePath = new ShapePath(this);
    }

    if (this.dirty) {
      this.dirty = false;
      this._shapePath.buildPath();
    }

    return this._shapePath;
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
  ): GraphicsPath {
    this.instructions.push({ action: 'bezierCurveTo', data: [cp1x, cp1y, cp2x, cp2y, x, y, smoothness] });

    this.dirty = true;

    return this;
  }

  /**
   * Sets the starting point for a new sub-path. Any subsequent drawing commands are considered part of this path.
   * @param x - The x-coordinate for the starting point.
   * @param y - The y-coordinate for the starting point.
   * @returns The instance of the current object for chaining.
   */
  moveTo (x: number, y: number): GraphicsPath {
    this.instructions.push({ action: 'moveTo', data: [x, y] });

    this.dirty = true;

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
  ellipse (x: number, y: number, radiusX: number, radiusY: number, transform?: Matrix4) {
    this.instructions.push({ action: 'ellipse', data: [x, y, radiusX, radiusY, transform] });

    this.dirty = true;

    return this;
  }

  /**
   * Draws a rectangle shape. This method adds a new rectangle path to the current drawing.
   * @param x - The x-coordinate of the top-left corner of the rectangle.
   * @param y - The y-coordinate of the top-left corner of the rectangle.
   * @param w - The width of the rectangle.
   * @param h - The height of the rectangle.
   * @param transform - An optional `Matrix` object to apply a transformation to the rectangle.
   * @returns The instance of the current object for chaining.
   */
  rect (x: number, y: number, w: number, h: number, transform?: Matrix4): this {
    this.instructions.push({ action: 'rect', data: [x, y, w, h, transform] });

    this.dirty = true;

    return this;
  }

  clear (): GraphicsPath {
    this.instructions.length = 0;
    this.dirty = true;

    return this;
  }
}

export interface PathInstruction {
  action:
  | 'moveTo'
  | 'lineTo'
  | 'quadraticCurveTo'
  | 'bezierCurveTo'
  | 'arc'
  | 'closePath'
  | 'addPath'
  | 'arcTo'
  | 'ellipse'
  | 'rect'
  | 'roundRect'
  | 'arcToSvg'
  | 'poly'
  | 'circle'
  | 'regularPoly'
  | 'roundPoly'
  | 'roundShape'
  | 'filletRect'
  | 'chamferRect'
  ,
  data: any[],
}
