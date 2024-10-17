import { Rectangle } from './rectangle';
import { ShapePrimitive } from './shape-primitive';

/**
 * A class to define a shape of a triangle via user defined coordinates.
 *
 * Create a `Triangle` object with the `x`, `y`, `x2`, `y2`, `x3`, `y3` properties.
 */
export class Triangle extends ShapePrimitive {
  /**
   * The X coord of the first point.
   * @default 0
   */
  x: number;
  /**
   * The Y coord of the first point.
   * @default 0
   */
  y: number;
  /**
   * The X coord of the second point.
   * @default 0
   */
  x2: number;
  /**
   * The Y coord of the second point.
   * @default 0
   */
  y2: number;
  /**
   * The X coord of the third point.
   * @default 0
   */
  x3: number;
  /**
   * The Y coord of the third point.
   * @default 0
   */
  y3: number;

  /**
   * @param x - The X coord of the first point.
   * @param y - The Y coord of the first point.
   * @param x2 - The X coord of the second point.
   * @param y2 - The Y coord of the second point.
   * @param x3 - The X coord of the third point.
   * @param y3 - The Y coord of the third point.
   */
  constructor (x = 0, y = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0) {
    super();
    this.x = x;
    this.y = y;
    this.x2 = x2;
    this.y2 = y2;
    this.x3 = x3;
    this.y3 = y3;
  }

  /**
   * Checks whether the x and y coordinates given are contained within this triangle
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coordinates are within this Triangle
   */
  contains (x: number, y: number): boolean {
    const s = ((this.x - this.x3) * (y - this.y3)) - ((this.y - this.y3) * (x - this.x3));
    const t = ((this.x2 - this.x) * (y - this.y)) - ((this.y2 - this.y) * (x - this.x));

    if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) { return false; }

    const d = ((this.x3 - this.x2) * (y - this.y2)) - ((this.y3 - this.y2) * (x - this.x2));

    return d === 0 || (d < 0) === (s + t <= 0);
  }

  /**
   * Checks whether the x and y coordinates given are contained within this triangle including the stroke.
   * @param pointX - The X coordinate of the point to test
   * @param pointY - The Y coordinate of the point to test
   * @param strokeWidth - The width of the line to check
   * @returns Whether the x/y coordinates are within this triangle
   */
  //  strokeContains (pointX: number, pointY: number, strokeWidth: number): boolean {
  //     const halfStrokeWidth = strokeWidth / 2;
  //     const halfStrokeWidthSquared = halfStrokeWidth * halfStrokeWidth;

  //     const { x, x2, x3, y, y2, y3 } = this;

  //     if (squaredDistanceToLineSegment(pointX, pointY, x, y, x2, y3) <= halfStrokeWidthSquared
  //             || squaredDistanceToLineSegment(pointX, pointY, x2, y2, x3, y3) <= halfStrokeWidthSquared
  //             || squaredDistanceToLineSegment(pointX, pointY, x3, y3, x, y) <= halfStrokeWidthSquared) {
  //       return true;
  //     }

  //     return false;
  //   }

  /**
   * Creates a clone of this Triangle
   * @returns a copy of the triangle
   */
  clone (): ShapePrimitive {
    const triangle = new Triangle(
      this.x,
      this.y,
      this.x2,
      this.y2,
      this.x3,
      this.y3
    );

    return triangle;
  }

  /**
   * Copies another triangle to this one.
   * @param triangle - The triangle to copy from.
   * @returns Returns itself.
   */
  copyFrom (triangle: Triangle): this {
    this.x = triangle.x;
    this.y = triangle.y;
    this.x2 = triangle.x2;
    this.y2 = triangle.y2;
    this.x3 = triangle.x3;
    this.y3 = triangle.y3;

    return this;
  }

  /**
   * Copies this triangle to another one.
   * @param triangle - The triangle to copy to.
   * @returns Returns given parameter.
   */
  copyTo (triangle: Triangle): Triangle {
    triangle.copyFrom(this);

    return triangle;
  }

  /**
   * Returns the framing rectangle of the triangle as a Rectangle object
   * @param out - optional rectangle to store the result
   * @returns The framing rectangle
   */
  getBounds (out?: Rectangle): Rectangle {
    out = out || new Rectangle();

    const minX = Math.min(this.x, this.x2, this.x3);
    const maxX = Math.max(this.x, this.x2, this.x3);
    const minY = Math.min(this.y, this.y2, this.y3);
    const maxY = Math.max(this.y, this.y2, this.y3);

    out.x = minX;
    out.y = minY;
    out.width = maxX - minX;
    out.height = maxY - minY;

    return out;
  }

  override getX (): number {
    return this.x;
  }

  override getY (): number {
    return this.y;
  }

  override build (points: number[]): void {
    points[0] = this.x;
    points[1] = this.y;
    points[2] = this.x2;
    points[3] = this.y2;
    points[4] = this.x3;
    points[5] = this.y3;
  }

  override triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number): void {
    let count = 0;
    const verticesStride = 2;

    verticesOffset *= verticesStride;

    vertices[verticesOffset + count] = points[0];
    vertices[verticesOffset + count + 1] = points[1];

    count += verticesStride;

    vertices[verticesOffset + count] = points[2];
    vertices[verticesOffset + count + 1] = points[3];

    count += verticesStride;

    vertices[verticesOffset + count] = points[4];
    vertices[verticesOffset + count + 1] = points[5];

    const verticesIndex = verticesOffset / verticesStride;

    // triangle 1
    indices[indicesOffset++] = verticesIndex;
    indices[indicesOffset++] = verticesIndex + 1;
    indices[indicesOffset++] = verticesIndex + 2;
  }
}
