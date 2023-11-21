import type { spec } from '@galacean/effects';
import { GeometryData } from './geometry';

// 面造型未单独抽离, 整个包围盒只接受一个材质
export class BoxGeometryData extends GeometryData {
  /**
   *
   * @param width
   * @param height
   * @param depth
   */
  constructor (width = 1, height = 1, depth = 1) {
    super();

    let numberOfVertices = 0;

    buildPlane(2, 1, 0, - 1, - 1, depth, height, width, this.points, this.uvs, this.normals, this.indices); // px
    buildPlane(2, 1, 0, 1, - 1, depth, height, - width, this.points, this.uvs, this.normals, this.indices); // nx
    buildPlane(0, 2, 1, 1, 1, width, depth, height, this.points, this.uvs, this.normals, this.indices); // py
    buildPlane(0, 2, 1, 1, - 1, width, depth, - height, this.points, this.uvs, this.normals, this.indices); // ny
    buildPlane(0, 1, 2, 1, - 1, width, height, depth, this.points, this.uvs, this.normals, this.indices); // pz
    buildPlane(0, 1, 2, - 1, - 1, width, height, - depth, this.points, this.uvs, this.normals, this.indices); // nz

    function buildPlane (u: number, v: number, w: number, uDir: number,
      vDir: number, width: number, height: number, depth: number,
      points: number[], uvs: number[], normals: number[], indices: number[]) {

      const widthHalf = width / 2;
      const heightHalf = height / 2;
      const depthHalf = depth / 2;
      const point: spec.vec3 = [0, 0, 0];
      let vertexCounter = 0;

      for (let iy = 0; iy < 2; iy++) {
        const y = iy * height - heightHalf;

        for (let ix = 0; ix < 2; ix++) {
          const x = ix * width - widthHalf;

          point[u] = x * uDir;
          point[v] = y * vDir;
          point[w] = depthHalf;

          points.push(...point);

          point[u] = 0;
          point[v] = 0;
          point[w] = depth > 0 ? 1 : - 1;

          normals.push(...point);

          uvs.push(ix);
          uvs.push(1 - iy);

          vertexCounter += 1;
        }
      }

      for (let iy = 0; iy < 1; iy++) {
        for (let ix = 0; ix < 1; ix++) {
          const a = numberOfVertices + ix + 2 * iy;
          const b = numberOfVertices + ix + 2 * (iy + 1);
          const c = numberOfVertices + (ix + 1) + 2 * (iy + 1);
          const d = numberOfVertices + (ix + 1) + 2 * iy;

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      numberOfVertices += vertexCounter;
    }
  }
}
