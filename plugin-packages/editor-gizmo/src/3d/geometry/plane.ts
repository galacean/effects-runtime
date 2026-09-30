import { GeometryData } from './geometry';

/**
 *
 */
export class PlaneGeometryData extends GeometryData {
  /**
   *
   * @param width
   * @param height
   * @param widthSegments
   * @param heightSegments
   */
  constructor (
    width = 1,
    height = 1,
    widthSegments = 1,
    heightSegments = 1,
  ) {
    super();

    const widthHalf = width / 2;
    const heightHalf = height / 2;

    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;

    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - heightHalf;

      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - widthHalf;

        this.points.push(x, - y, 0);
        this.normals.push(0, 0, 1);
        this.uvs.push(ix / gridX);
        this.uvs.push(1 - (iy / gridY));
      }
    }
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;

        this.indices.push(a, b, d);
        this.indices.push(b, c, d);
      }
    }
  }
}
