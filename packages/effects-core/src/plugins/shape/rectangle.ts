// Based on:
// https://github.com/pixijs/pixijs/blob/dev/src/maths/shapes/RoundedRectangle.ts

import { ShapePrimitive } from './shape-primitive';

/**
 * The `Rectangle` object is an area defined by its position, as indicated by its top-left corner
 * point (`x`, `y`) and by its `width` and its `height`, including a `roundness` property that
 * defines the roundness of the rounded corners.
 * @memberof maths
 */
export class Rectangle extends ShapePrimitive {
  /**
   * The X coordinate of the upper-left corner of the rectangle
   */
  x: number;

  /**
   * The Y coordinate of the upper-left corner of the rectangle
   */
  y: number;

  /**
   * The overall width of this rectangle
   */
  width: number;

  /**
   * The overall height of this rectangle
   */
  height: number;

  /**
   * Controls the roundness of the rounded corners
   */
  roundness: number;

  /**
   * @param x - The X coordinate of the upper-left corner of the rectangle
   * @param y - The Y coordinate of the upper-left corner of the rectangle
   * @param width - The overall width of this rectangle
   * @param height - The overall height of this rectangle
   * @param roundness - Controls the roundness of the rounded corners
   */
  constructor (x = 0, y = 0, width = 0, height = 0, roundness = 20) {
    super();
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.roundness = roundness;
  }

  /**
   * Returns the framing rectangle of the rectangle as a Rectangle object
   * @param out - optional rectangle to store the result
   * @returns The framing rectangle
   */
  getBounds (out?: Rectangle): Rectangle {
    out = out || new Rectangle();

    out.x = this.x;
    out.y = this.y;
    out.width = this.width;
    out.height = this.height;

    return out;
  }

  /**
   * Creates a clone of this rectangle.
   * @returns - A copy of the rectangle.
   */
  clone (): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height, this.roundness);
  }

  /**
   * Copies another rectangle to this one.
   * @param rectangle - The rectangle to copy from.
   * @returns Returns itself.
   */
  copyFrom (rectangle: Rectangle): this {
    this.x = rectangle.x;
    this.y = rectangle.y;
    this.width = rectangle.width;
    this.height = rectangle.height;

    return this;
  }

  /**
   * Copies this rectangle to another one.
   * @param rectangle - The rectangle to copy to.
   * @returns Returns given parameter.
   */
  copyTo (rectangle: Rectangle): Rectangle {
    rectangle.copyFrom(this);

    return rectangle;
  }

  override build (points: number[]): void {
    let ry;

    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    const x = this.x + halfWidth;
    const y = this.y + halfHeight;
    const rx = ry = Math.max(0, Math.min(this.roundness / 100, 1) * Math.min(halfWidth, halfHeight));
    const dx = halfWidth - rx;
    const dy = halfHeight - ry;

    if (!(rx >= 0 && ry >= 0 && dx >= 0 && dy >= 0)) {
      return;
    }

    // 控制边缘的平滑程度
    const densityScale = 5;
    // Choose a number of segments such that the maximum absolute deviation from the circle is approximately 0.029
    const n = densityScale * Math.ceil(2.3 * Math.sqrt(rx + ry));
    const m = (n * 8) + (dx ? 4 : 0) + (dy ? 4 : 0);

    if (m === 0) {
      return;
    }

    if (n === 0) {
      points[0] = points[6] = x + dx;
      points[1] = points[3] = y + dy;
      points[2] = points[4] = x - dx;
      points[5] = points[7] = y - dy;

      return;
    }

    let j1 = 0;
    let j2 = (n * 4) + (dx ? 2 : 0) + 2;
    let j3 = j2;
    let j4 = m;

    let x0 = dx + rx;
    let y0 = dy;
    let x1 = x + x0;
    let x2 = x - x0;
    let y1 = y + y0;

    points[j1++] = x1;
    points[j1++] = y1;
    points[--j2] = y1;
    points[--j2] = x2;

    if (dy) {
      const y2 = y - y0;

      points[j3++] = x2;
      points[j3++] = y2;
      points[--j4] = y2;
      points[--j4] = x1;
    }

    for (let i = 1; i < n; i++) {
      const a = Math.PI / 2 * (i / n);
      const x0 = dx + (Math.cos(a) * rx);
      const y0 = dy + (Math.sin(a) * ry);
      const x1 = x + x0;
      const x2 = x - x0;
      const y1 = y + y0;
      const y2 = y - y0;

      points[j1++] = x1;
      points[j1++] = y1;
      points[--j2] = y1;
      points[--j2] = x2;
      points[j3++] = x2;
      points[j3++] = y2;
      points[--j4] = y2;
      points[--j4] = x1;
    }

    x0 = dx;
    y0 = dy + ry;
    x1 = x + x0;
    x2 = x - x0;
    y1 = y + y0;
    const y2 = y - y0;

    points[j1++] = x1;
    points[j1++] = y1;
    points[--j4] = y2;
    points[--j4] = x1;

    if (dx) {
      points[j1++] = x2;
      points[j1++] = y1;
      points[--j4] = y2;
      points[--j4] = x2;
    }
  }

  override triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number): void {
    if (points.length === 0) {
      return;
    }

    // Compute center (average of all points)
    let centerX = 0; let
      centerY = 0;

    for (let i = 0; i < points.length; i += 2) {
      centerX += points[i];
      centerY += points[i + 1];
    }
    centerX /= (points.length / 2);
    centerY /= (points.length / 2);

    // Set center vertex
    let count = verticesOffset;

    vertices[count * 2] = centerX;
    vertices[(count * 2) + 1] = centerY;
    const centerIndex = count++;

    // Set edge vertices and indices
    for (let i = 0; i < points.length; i += 2) {
      vertices[count * 2] = points[i];
      vertices[(count * 2) + 1] = points[i + 1];

      if (i > 0) { // Skip first point for indices
        indices[indicesOffset++] = count;
        indices[indicesOffset++] = centerIndex;
        indices[indicesOffset++] = count - 1;
      }
      count++;
    }

    // Connect last point to the first edge point
    indices[indicesOffset++] = centerIndex + 1;
    indices[indicesOffset++] = centerIndex;
    indices[indicesOffset++] = count - 1;
  }
}
