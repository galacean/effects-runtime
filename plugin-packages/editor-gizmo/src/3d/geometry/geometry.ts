/**
 * 基础几何数据[抽象类，不可以直接用来初始化]
 */
export abstract class GeometryData {
  points: number[] = [];
  uvs: number[] = [];
  normals: number[] = [];
  indices: number[] = [];

  /**
   * 构件 XY 平面圆（圆心为(0, 0, z)）
   * @param radius - 圆半径
   * @param z - z 值
   * @param segments - 圆精度
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   * @param startIndex - 索引起始值
   * @param points - 点数据
   * @param indices - 索引数据
   */
  createXYPlaneCircle (
    radius: number,
    z: number,
    segments: number,
    thetaStart: number,
    thetaLength: number,
    startIndex: number,
    points: number[],
    indices: number[],
  ) {
    for (let i = 0; i < segments; i++) {
      const theta = thetaStart + i * thetaLength / segments;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);

      points.push(x, y, z);
      indices.push(startIndex + i, startIndex + (i + 1) % segments);
    }
  }

  /**
   * 构件 XZ 平面圆（圆心为(0, y, 0)）
   * @param radius - 圆半径
   * @param y - y 值
   * @param segments - 圆精度
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   * @param startIndex - 索引起始值
   * @param points - 点数据
   * @param indices - 索引数据
   */
  createXZPlaneCircle (
    radius: number,
    y: number,
    segments: number,
    thetaStart: number,
    thetaLength: number,
    startIndex: number,
    points: number[],
    indices: number[],
  ) {
    for (let i = 0; i < segments; i++) {
      const theta = thetaStart + i * thetaLength / segments;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);

      points.push(x, y, z);
      indices.push(startIndex + i, startIndex + (i + 1) % segments);
    }
  }

  /**
   * 构件 YZ 平面圆（圆心为(x, 0, 0)）
   * @param radius - 圆半径
   * @param x - x 值
   * @param segments - 圆精度
   * @param thetaStart - 起始弧度
   * @param thetaLength - 终止弧度
   * @param startIndex - 索引起始值
   * @param points - 点数据
   * @param indices - 索引数据
   */
  createYZPlaneCircle (
    radius: number,
    x: number,
    segments: number,
    thetaStart: number,
    thetaLength: number,
    startIndex: number,
    points: number[],
    indices: number[],
  ) {
    for (let i = 0; i < segments; i++) {
      const theta = thetaStart + i * thetaLength / segments;
      const z = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);

      points.push(x, y, z);
      indices.push(startIndex + i, startIndex + (i + 1) % segments);
    }
  }
}
