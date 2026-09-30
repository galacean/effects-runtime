import { GeometryData } from './geometry';

/**
 * 地板线边框造型数据
 * lines
 */
export class FloorLineEdgeGeometryData extends GeometryData {
  /**
   *
   * @param sideLength
   * @param parts
   */
  constructor (sideLength = 12, parts = 6) {
    super();

    let index = 0;

    const z = 0;
    const end = sideLength / 2;
    const start = -sideLength / 2;

    for (let i = 0; i <= parts; i++) {
      const v = start + i * sideLength / parts;

      this.points.push(v, start, z, v, end, z, start, v, z, end, v, z);
      this.indices.push(index, index + 1, index + 2, index + 3);
      index += 4;
    }
  }
}
