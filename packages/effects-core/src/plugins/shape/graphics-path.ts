/**
 * Based on:
 * https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/path/GraphicsPath.ts
 */

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
    smoothness?: number
  ): GraphicsPath {
    this.instructions.push({ action: 'bezierCurveTo', data: [cp1x, cp1y, cp2x, cp2y, x, y, smoothness] });

    this.dirty = true;

    return this;
  }

  moveTo (x: number, y: number): GraphicsPath {
    this.instructions.push({ action: 'moveTo', data: [x, y] });

    this.dirty = true;

    return this;
  }

  clear (): GraphicsPath {
    this.instructions.length = 0;
    this.dirty = true;

    return this;
  }
}

export interface PathInstruction
{
  action: 'moveTo' | 'lineTo' | 'quadraticCurveTo' |
  'bezierCurveTo' | 'arc' | 'closePath' |
  'addPath' | 'arcTo' | 'ellipse' |
  'rect' | 'roundRect' | 'arcToSvg' |
  'poly' | 'circle' |
  'regularPoly' | 'roundPoly' | 'roundShape' | 'filletRect' | 'chamferRect',
  data: any[],
}