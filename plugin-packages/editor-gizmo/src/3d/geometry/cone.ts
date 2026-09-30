import { CylinderGeometryData } from './cylinder';

/**
 *
 */
export class ConeGeometryData extends CylinderGeometryData {
  /**
   *
   * @param radius
   * @param height
   * @param radialSegments
   * @param heightSegments
   * @param openEnded
   * @param thetaStart
   * @param thetaLength
   */
  constructor (
    radius = 1,
    height = 1,
    radialSegments = 8,
    heightSegments = 1,
    openEnded = false,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
  }
}
