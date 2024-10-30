import { ShapePrimitive } from './shape-primitive';

/**
 * The Ellipse object is used to help draw graphics and can also be used to specify a hit area for containers.
 */
export class Ellipse extends ShapePrimitive {
  /**
   * The X coordinate of the center of this ellipse
   * @default 0
   */
  x: number;

  /**
   * The Y coordinate of the center of this ellipse
   * @default 0
   */
  y: number;

  /**
   * The half width of this ellipse
   * @default 0
   */
  halfWidth: number;

  /**
   * The half height of this ellipse
   * @default 0
   */
  halfHeight: number;

  /**
   * The type of the object, mainly used to avoid `instanceof` checks
   * @default 'ellipse'
   */
  readonly type = 'ellipse';

  /**
   * @param x - The X coordinate of the center of this ellipse
   * @param y - The Y coordinate of the center of this ellipse
   * @param halfWidth - The half width of this ellipse
   * @param halfHeight - The half height of this ellipse
   */
  constructor (x = 0, y = 0, halfWidth = 0, halfHeight = 0) {
    super();
    this.x = x;
    this.y = y;
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
  }

  /**
   * Creates a clone of this Ellipse instance
   * @returns {Ellipse} A copy of the ellipse
   */
  clone (): Ellipse {
    return new Ellipse(this.x, this.y, this.halfWidth, this.halfHeight);
  }

  /**
   * Checks whether the x and y coordinates given are contained within this ellipse
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @returns Whether the x/y coords are within this ellipse
   */
  contains (x: number, y: number): boolean {
    if (this.halfWidth <= 0 || this.halfHeight <= 0) {
      return false;
    }

    // normalize the coords to an ellipse with center 0,0
    let normx = ((x - this.x) / this.halfWidth);
    let normy = ((y - this.y) / this.halfHeight);

    normx *= normx;
    normy *= normy;

    return (normx + normy <= 1);
  }

  /**
   * Checks whether the x and y coordinates given are contained within this ellipse including stroke
   * @param x - The X coordinate of the point to test
   * @param y - The Y coordinate of the point to test
   * @param width
   * @returns Whether the x/y coords are within this ellipse
   */
  strokeContains (x: number, y: number, width: number): boolean {
    const { halfWidth, halfHeight } = this;

    if (halfWidth <= 0 || halfHeight <= 0) {
      return false;
    }

    const halfStrokeWidth = width / 2;
    const innerA = halfWidth - halfStrokeWidth;
    const innerB = halfHeight - halfStrokeWidth;
    const outerA = halfWidth + halfStrokeWidth;
    const outerB = halfHeight + halfStrokeWidth;

    const normalizedX = x - this.x;
    const normalizedY = y - this.y;

    const innerEllipse = ((normalizedX * normalizedX) / (innerA * innerA))
      + ((normalizedY * normalizedY) / (innerB * innerB));
    const outerEllipse = ((normalizedX * normalizedX) / (outerA * outerA))
      + ((normalizedY * normalizedY) / (outerB * outerB));

    return innerEllipse > 1 && outerEllipse <= 1;
  }

  /**
   * Returns the framing rectangle of the ellipse as a Rectangle object
   * @param out
   * @returns The framing rectangle
   */
  //   getBounds (out?: Rectangle): Rectangle {
  //     out = out || new Rectangle();

  //     out.x = this.x - this.halfWidth;
  //     out.y = this.y - this.halfHeight;
  //     out.width = this.halfWidth * 2;
  //     out.height = this.halfHeight * 2;

  //     return out;
  //   }

  /**
   * Copies another ellipse to this one.
   * @param ellipse - The ellipse to copy from.
   * @returns Returns itself.
   */
  copyFrom (ellipse: Ellipse): this {
    this.x = ellipse.x;
    this.y = ellipse.y;
    this.halfWidth = ellipse.halfWidth;
    this.halfHeight = ellipse.halfHeight;

    return this;
  }

  /**
   * Copies this ellipse to another one.
   * @param ellipse - The ellipse to copy to.
   * @returns Returns given parameter.
   */
  copyTo (ellipse: Ellipse): Ellipse {
    ellipse.copyFrom(this);

    return ellipse;
  }

  getX (): number {
    return this.x;
  }

  getY (): number {
    return this.y;
  }

  build (points: number[]) {
    const x = this.x;
    const y = this.y;
    const rx = this.halfWidth;
    const ry = this.halfHeight;
    const dx = 0;
    const dy = 0;

    if (!(rx >= 0 && ry >= 0 && dx >= 0 && dy >= 0)) {
      return points;
    }

    // Choose a number of segments such that the maximum absolute deviation from the circle is approximately 0.029
    const sampleDensity = 5;
    const n = Math.ceil(sampleDensity * Math.sqrt(rx + ry));
    const m = (n * 8) + (dx ? 4 : 0) + (dy ? 4 : 0);

    if (m === 0) {
      return points;
    }

    if (n === 0) {
      points[0] = points[6] = x + dx;
      points[1] = points[3] = y + dy;
      points[2] = points[4] = x - dx;
      points[5] = points[7] = y - dy;

      return points;
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

    return points;
  }

  triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number) {
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
