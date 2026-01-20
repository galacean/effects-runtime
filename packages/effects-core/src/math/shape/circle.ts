// Based on:
// https://github.com/pixijs/pixijs/blob/dev/src/maths/shapes/Circle.ts

import { Rectangle } from './rectangle';
import { ShapePrimitive } from './shape-primitive';

/**
 * The Circle object represents a circle shape in a two-dimensional coordinate system.
 * Used for drawing graphics and specifying hit areas for containers.
 * @example
 * ```ts
 * // Basic circle creation
 * const circle = new Circle(100, 100, 50);
 *
 * // Use as hit area
 * container.hitArea = new Circle(0, 0, 100);
 *
 * // Check point containment
 * const isInside = circle.contains(mouseX, mouseY);
 *
 * // Get bounding box
 * const bounds = circle.getBounds();
 * ```
 * @remarks
 * - Defined by center (x,y) and radius
 * - Supports point containment tests
 * - Can check stroke intersections
 * @see {@link Rectangle} For rectangular shapes
 * @category maths
 * @standard
 */
export class Circle extends ShapePrimitive {
  /**
     * The X coordinate of the center of this circle
     * @example
     * ```ts
     * // Basic x position
     * const circle = new Circle();
     * circle.x = 100;
     *
     * // Center circle on point
     * circle.x = point.x;
     * ```
     * @default 0
     */
  x: number;

  /**
     * The Y coordinate of the center of this circle
     * @example
     * ```ts
     * // Basic y position
     * const circle = new Circle();
     * circle.y = 200;
     *
     * // Center circle on point
     * circle.y = point.y;
     * ```
     * @default 0
     */
  y: number;

  /**
     * The radius of the circle
     * @example
     * ```ts
     * // Basic radius setting
     * const circle = new Circle(100, 100);
     * circle.radius = 50;
     *
     * // Calculate area
     * const area = Math.PI * circle.radius * circle.radius;
     * ```
     * @default 0
     */
  radius: number;

  /**
     * @param x - The X coordinate of the center of this circle
     * @param y - The Y coordinate of the center of this circle
     * @param radius - The radius of the circle
     */
  constructor (x = 0, y = 0, radius = 0) {
    super();
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  /**
     * Creates a clone of this Circle instance.
     * @example
     * ```ts
     * // Basic circle cloning
     * const original = new Circle(100, 100, 50);
     * const copy = original.clone();
     *
     * // Clone and modify
     * const modified = original.clone();
     * modified.radius = 75;
     *
     * // Verify independence
     * console.log(original.radius); // 50
     * console.log(modified.radius); // 75
     * ```
     * @returns A copy of the Circle
     * @see {@link Circle.copyFrom} For copying into existing circle
     * @see {@link Circle.copyTo} For copying to another circle
     */
  clone (): Circle {
    return new Circle(this.x, this.y, this.radius);
  }

  /**
     * Checks whether the x and y coordinates given are contained within this circle.
     *
     * Uses the distance formula to determine if a point is inside the circle's radius.
     *
     * Commonly used for hit testing in PixiJS events and graphics.
     * @example
     * ```ts
     * // Basic containment check
     * const circle = new Circle(100, 100, 50);
     * const isInside = circle.contains(120, 120);
     *
     * // Check mouse position
     * const circle = new Circle(0, 0, 100);
     * container.hitArea = circle;
     * container.on('pointermove', (e) => {
     *     // only called if pointer is within circle
     * });
     * ```
     * @param x - The X coordinate of the point to test
     * @param y - The Y coordinate of the point to test
     * @returns Whether the x/y coordinates are within this Circle
     * @see {@link Circle.strokeContains} For checking stroke intersection
     * @see {@link Circle.getBounds} For getting bounding box
     */
  contains (x: number, y: number): boolean {
    if (this.radius <= 0) {return false;}

    const r2 = this.radius * this.radius;
    let dx = (this.x - x);
    let dy = (this.y - y);

    dx *= dx;
    dy *= dy;

    return (dx + dy <= r2);
  }

  /**
     * Checks whether the x and y coordinates given are contained within this circle including the stroke.
     * @example
     * ```ts
     * // Basic stroke check
     * const circle = new Circle(100, 100, 50);
     * const isOnStroke = circle.strokeContains(150, 100, 4); // 4px line width
     *
     * // Check with different alignments
     * const innerStroke = circle.strokeContains(150, 100, 4, 1);   // Inside
     * const centerStroke = circle.strokeContains(150, 100, 4, 0.5); // Centered
     * const outerStroke = circle.strokeContains(150, 100, 4, 0);   // Outside
     * ```
     * @param x - The X coordinate of the point to test
     * @param y - The Y coordinate of the point to test
     * @param width - The width of the line to check
     * @param alignment - The alignment of the stroke, 0.5 by default
     * @returns Whether the x/y coordinates are within this Circle's stroke
     * @see {@link Circle.contains} For checking fill containment
     * @see {@link Circle.getBounds} For getting stroke bounds
     */
  strokeContains (x: number, y: number, width: number, alignment: number = 0.5): boolean {
    if (this.radius === 0) {return false;}

    const dx = (this.x - x);
    const dy = (this.y - y);
    const radius = this.radius;
    const outerWidth = (1 - alignment) * width;
    const distance = Math.sqrt((dx * dx) + (dy * dy));

    return (distance <= radius + outerWidth && distance > radius - (width - outerWidth));
  }

  /**
     * Returns the framing rectangle of the circle as a Rectangle object.
     * @example
     * ```ts
     * // Basic bounds calculation
     * const circle = new Circle(100, 100, 50);
     * const bounds = circle.getBounds();
     * // bounds: x=50, y=50, width=100, height=100
     *
     * // Reuse existing rectangle
     * const rect = new Rectangle();
     * circle.getBounds(rect);
     * ```
     * @param out - Optional Rectangle object to store the result
     * @returns The framing rectangle
     * @see {@link Rectangle} For rectangle properties
     * @see {@link Circle.contains} For point containment
     */
  getBounds (out?: Rectangle): Rectangle {
    out ||= new Rectangle();

    out.x = this.x - this.radius;
    out.y = this.y - this.radius;
    out.width = this.radius * 2;
    out.height = this.radius * 2;

    return out;
  }

  /**
     * Copies another circle to this one.
     * @example
     * ```ts
     * // Basic copying
     * const source = new Circle(100, 100, 50);
     * const target = new Circle();
     * target.copyFrom(source);
     * ```
     * @param circle - The circle to copy from
     * @returns Returns itself
     * @see {@link Circle.copyTo} For copying to another circle
     * @see {@link Circle.clone} For creating new circle copy
     */
  copyFrom (circle: Circle): this {
    this.x = circle.x;
    this.y = circle.y;
    this.radius = circle.radius;

    return this;
  }

  /**
     * Copies this circle to another one.
     * @example
     * ```ts
     * // Basic copying
     * const source = new Circle(100, 100, 50);
     * const target = new Circle();
     * source.copyTo(target);
     * ```
     * @param circle - The circle to copy to
     * @returns Returns given parameter
     * @see {@link Circle.copyFrom} For copying from another circle
     * @see {@link Circle.clone} For creating new circle copy
     */
  copyTo (circle: Circle): Circle {
    circle.copyFrom(this);

    return circle;
  }

  override build (points: number[]): void {
    const x = this.x;
    const y = this.y;
    const dx = 0;
    const dy = 0;

    const rx = this.radius;
    const ry = this.radius;

    if (rx <= 0) {
      return;
    }

    if (dx < 0 || dy < 0) {
      return;
    }

    // Choose a number of segments such that the maximum absolute deviation from the circle is approximately 0.029
    const n = Math.ceil(2.3 * Math.sqrt(rx + ry));
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

    return;
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
