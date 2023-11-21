import { GeometryData } from './geometry';

/**
 * 地板线造型数据
 * lines
 */
export class FloorLineGeometryData extends GeometryData {
  /**
   *
   * @param sideLength
   * @param parts
   * @param subparts
   */
  constructor (sideLength = 12, parts = 6, subparts = 5) {
    super();

    const start = -sideLength / 2;
    const end = sideLength / 2;
    let index = 0;
    const z = 0;

    for (let i = 0; i <= parts; i++) {
      for (let j = 1; j < subparts; j++) {
        const partLength = sideLength / parts;
        const v = start + i * partLength + j * partLength / 5;

        this.points.push(v, start, z, v, end, z, start, v, z, end, v, z);
        this.indices.push(index, index + 1, index + 2, index + 3);
        index += 4;
      }
    }
  }
}
