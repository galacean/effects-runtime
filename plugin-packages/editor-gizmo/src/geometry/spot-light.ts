import { GeometryData } from './geometry';

/**
 * 聚光灯造型数据
 * lines
 */
export class SpotLightData extends GeometryData {
  /**
   * 构造函数
   * @param range - 光线范围
   * @param spotAngle - 光线范围[角度]
   * @param segments - 圆精度
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   */
  constructor (
    range = 10,
    spotAngle = 30,
    segments = 64,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super();

    const angle = spotAngle / 2 / 180 * Math.PI;
    const radius = range * Math.tan(angle);

    this.createXYPlaneCircle(radius, -range, segments, thetaStart, thetaLength, 0, this.points, this.indices);
    this.points.push(0, 0, 0);
    const step = segments / 4;
    const start = segments % 4 / 2;

    for (let i = 0; i < 4; i++) {
      this.indices.push(segments, start + i * step);
    }
  }
}
