import { GeometryData } from './geometry';

/**
 * 点光源造型数据
 * lines
 */
export class PointLightData extends GeometryData {
  /**
   * 构造函数
   * @param range - 光照范围
   * @param segments - 圆精度
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   */
  constructor (
    range = 10,
    segments = 64,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super();
    this.createXYPlaneCircle(range, 0, segments, thetaStart, thetaLength, 0, this.points, this.indices);
    this.createXZPlaneCircle(range, 0, segments, thetaStart, thetaLength, segments, this.points, this.indices);
    this.createYZPlaneCircle(range, 0, segments, thetaStart, thetaLength, 2 * segments, this.points, this.indices);
  }
}
