import type { PointData } from './point-data';

/**
 * Common interface for points. Both Point and ObservablePoint implement it
 */
export interface PointLike extends PointData {
  /**
   * Copies x and y from the given point
   * @param p - The point to copy from
   * @returns Returns itself.
   */
  copyFrom: (p: PointData) => this,
  /**
   * Copies x and y into the given point
   * @param p - The point to copy.fds
   * @returns Given point with values updated
   */
  copyTo: <T extends PointLike>(p: T) => T,
  /**
   * Returns true if the given point is equal to this point
   * @param p - The point to check
   * @returns Whether the given point equal to this point
   */
  equals: (p: PointData) => boolean,
  /**
   * Sets the point to a new x and y position.
   * If y is omitted, both x and y will be set to x.
   * @param {number} [x=0] - position of the point on the x axis
   * @param {number} [y=x] - position of the point on the y axis
   */
  set: (x?: number, y?: number) => void,
}

