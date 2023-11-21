import { GeometryData } from './geometry';
import { vecNormalize } from '../math/vec';

/**
 *
 */
export class SphereGeometryData extends GeometryData {
  /**
   *
   * @param radius
   * @param widthSegments
   * @param heightSegments
   * @param phiStart
   * @param phiLength
   * @param thetaStart
   * @param thetaLength
   */
  constructor (
    radius = 1,
    widthSegments = 8,
    heightSegments = 6,
    phiStart = 0,
    phiLength = Math.PI * 2,
    thetaStart = 0,
    thetaLength = Math.PI,
  ) {
    super();

    // 限制至少需要分为六块以保持形状
    widthSegments = Math.max(3, Math.floor(widthSegments));
    heightSegments = Math.max(2, Math.floor(heightSegments));

    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);
    const grid = [];
    let index = 0;

    for (let iy = 0; iy <= heightSegments; iy++) {
      const verticesRow = [];
      const v = iy / heightSegments;

      let uOffset = 0;

      if (iy == 0 && thetaStart == 0) {
        uOffset = 0.5 / widthSegments;
      } else if (iy == heightSegments && thetaEnd == Math.PI) {
        uOffset = - 0.5 / widthSegments;
      }

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;

        // point
        const x = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
        const y = radius * Math.cos(thetaStart + v * thetaLength);
        const z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

        this.points.push(x, y, z);

        // normal
        const normal = vecNormalize([x, y, z]);

        this.normals.push(...normal);

        // uv
        this.uvs.push(u + uOffset, 1 - v);

        verticesRow.push(index++);
      }

      grid.push(verticesRow);
    }

    // indices
    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = grid[iy][ix + 1];
        const b = grid[iy][ix];
        const c = grid[iy + 1][ix];
        const d = grid[iy + 1][ix + 1];

        if (iy !== 0 || thetaStart > 0) { this.indices.push(a, b, d); }
        if (iy !== heightSegments - 1 || thetaEnd < Math.PI) { this.indices.push(b, c, d); }
      }
    }
  }
}
