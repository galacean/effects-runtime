// Based on:
// https://github.com/pixijs/pixijs/blob/dev/src/maths/shapes/Polygon.ts

import { ShapePrimitive } from './shape-primitive';
import type { PointData } from './point-data';
import { triangulate } from './triangulate';

/**
 * A class to define a shape via user defined coordinates.
 */
export class Polygon extends ShapePrimitive {
  /**
   * An array of the points of this polygon.
   */
  points: number[] = [];

  /**
   * `false` after moveTo, `true` after `closePath`. In all other cases it is `true`.
   */
  closePath: boolean = false;

  constructor (points: PointData[] | number[]);
  constructor (...points: PointData[] | number[]);
  /**
   * @param points - This can be an array of Points
   *  that form the polygon, a flat array of numbers that will be interpreted as [x,y, x,y, ...], or
   *  the arguments passed can be all the points of the polygon e.g.
   *  `new Polygon(new Point(), new Point(), ...)`, or the arguments passed can be flat
   *  x,y values e.g. `new Polygon(x,y, x,y, x,y, ...)` where `x` and `y` are Numbers.
   */
  constructor (...points: (PointData[] | number[])[] | PointData[] | number[]) {
    super();
    let flat = Array.isArray(points[0]) ? points[0] : points;

    // if this is an array of points, convert it to a flat array of numbers
    if (typeof flat[0] !== 'number') {
      const p: number[] = [];

      for (let i = 0, il = flat.length; i < il; i++) {
        p.push((flat[i] as PointData).x, (flat[i] as PointData).y);
      }

      flat = p;
    }

    this.points = flat as number[];
    this.closePath = true;
  }

  /**
   * Creates a clone of this polygon.
   * @returns - A copy of the polygon.
   */
  clone (): Polygon {
    const points = this.points.slice();
    const polygon = new Polygon(points);

    polygon.closePath = this.closePath;

    return polygon;
  }

  /**
   * Checks whether the x and y coordinates passed to this function are contained within this polygon.
   * @param x - The X coordinate of the point to test.
   * @param y - The Y coordinate of the point to test.
   * @returns - Whether the x/y coordinates are within this polygon.
   */
  contains (x: number, y: number): boolean {
    let inside = false;

    // use some raycasting to test hits
    // https://github.com/substack/point-in-polygon/blob/master/index.js
    const length = this.points.length / 2;

    for (let i = 0, j = length - 1; i < length; j = i++) {
      const xi = this.points[i * 2];
      const yi = this.points[(i * 2) + 1];
      const xj = this.points[j * 2];
      const yj = this.points[(j * 2) + 1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Copies another polygon to this one.
   * @param polygon - The polygon to copy from.
   * @returns Returns itself.
   */
  copyFrom (polygon: Polygon): this {
    this.points = polygon.points.slice();
    this.closePath = polygon.closePath;

    return this;
  }

  /**
   * Copies this polygon to another one.
   * @param polygon - The polygon to copy to.
   * @returns Returns given parameter.
   */
  copyTo (polygon: Polygon): Polygon {
    polygon.copyFrom(this);

    return polygon;
  }

  /**
   * Get the last X coordinate of the polygon
   * @readonly
   */
  get lastX (): number {
    return this.points[this.points.length - 2];
  }

  /**
   * Get the last Y coordinate of the polygon
   * @readonly
   */
  get lastY (): number {
    return this.points[this.points.length - 1];
  }

  /**
   * Get the first X coordinate of the polygon
   * @readonly
   */
  getX (): number {
    return this.points[this.points.length - 2];
  }
  /**
   * Get the first Y coordinate of the polygon
   * @readonly
   */
  getY (): number {
    return this.points[this.points.length - 1];
  }

  override build (points: number[]): void {
    for (let i = 0; i < this.points.length; i++) {
      points[i] = this.points[i];
    }
  }

  override triangulate (points: number[], vertices: number[], verticesOffset: number, indices: number[], indicesOffset: number): void {
    const triangles = triangulate([points]);
    const indexStart = vertices.length / 2;

    for (let i = 0; i < triangles.length; i++) {
      vertices[verticesOffset * 2 + i] = triangles[i];
    }

    const vertexCount = triangles.length / 2;

    for (let i = 0; i < vertexCount; i++) {
      indices[indicesOffset + i] = indexStart + i;
    }
  }
}

