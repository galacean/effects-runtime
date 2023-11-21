import { GeometryData } from './geometry';

/**
 * 方向光造型数据
 * lines
 */
export class DirectionLightData extends GeometryData {
  /**
   * 构造函数
   * @param radius - 圆半径
   * @param length - 光线长度
   * @param segments - 圆精度
   * @param linesNumber - 光线数量
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   */
  constructor (
    radius = 1,
    length = 2,
    segments = 64,
    linesNumber = 8,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super();

    this.createXYPlaneCircle(radius, 0, segments, thetaStart, thetaLength, 0, this.points, this.indices);
    const start = segments % linesNumber / 2;
    const step = segments / linesNumber;

    for (let i = 0; i < linesNumber; i++) {
      const index = start + i * step;
      const x = this.points[3 * index];
      const y = this.points[3 * index + 1];
      const z = -length;

      this.points.push(x, y, z);
      this.indices.push(index, segments + i);
    }
  }
}
