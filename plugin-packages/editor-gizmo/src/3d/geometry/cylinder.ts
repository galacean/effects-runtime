import { math } from '@galacean/effects';
import { GeometryData } from './geometry';

const { Vector3 } = math;

/**
 *
 */
export class CylinderGeometryData extends GeometryData {
  /**
   *
   * @param radiusTop
   * @param radiusBottom
   * @param height
   * @param radialSegments
   * @param heightSegments
   * @param openEnded
   * @param thetaStart
   * @param thetaLength
   */
  constructor (
    radiusTop = 1,
    radiusBottom = 1,
    height = 1,
    radialSegments = 8,
    heightSegments = 1,
    openEnded = false,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super();
    radialSegments = Math.floor(radialSegments);
    heightSegments = Math.floor(heightSegments);

    let index = 0;
    const indexArray: number[][] = [];
    const halfHeight = height / 2;

    generateTorso(this.points, this.uvs, this.normals, this.indices);

    if (openEnded === false) {
      if (radiusTop > 0) { generateCap(true, this.points, this.uvs, this.normals, this.indices); }
      if (radiusBottom > 0) { generateCap(false, this.points, this.uvs, this.normals, this.indices); }
    }

    function generateTorso (points: number[], uvs: number[], normals: number[], indices: number[]) {
      // this will be used to calculate the normal
      const slope = (radiusBottom - radiusTop) / height;

      for (let y = 0; y <= heightSegments; y++) {
        const indexRow = [];
        const v = y / heightSegments;

        const radius = v * (radiusBottom - radiusTop) + radiusTop;

        for (let x = 0; x <= radialSegments; x++) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          const px = radius * sinTheta;
          const py = - v * height + halfHeight;
          const pz = radius * cosTheta;

          points.push(px, py, pz);

          const normal = new Vector3(sinTheta, slope, cosTheta).normalize();

          normals.push(...normal.toArray());

          uvs.push(u, 1 - v);

          indexRow.push(index++);
        }
        indexArray.push(indexRow);
      }

      for (let x = 0; x < radialSegments; x++) {
        for (let y = 0; y < heightSegments; y++) {
          const a = indexArray[y][x];
          const b = indexArray[y + 1][x];
          const c = indexArray[y + 1][x + 1];
          const d = indexArray[y][x + 1];

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
    }

    function generateCap (top: boolean, points: number[], uvs: number[], normals: number[], indices: number[]) {
      const centerIndexStart = index;

      const radius = (top === true) ? radiusTop : radiusBottom;
      const sign = (top === true) ? 1 : - 1;

      for (let x = 1; x <= radialSegments; x++) {
        points.push(0, halfHeight * sign, 0);
        normals.push(0, sign, 0);
        uvs.push(0.5, 0.5);

        index++;
      }

      const centerIndexEnd = index;

      for (let x = 0; x <= radialSegments; x++) {

        const u = x / radialSegments;
        const theta = u * thetaLength + thetaStart;

        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        const px = radius * sinTheta;
        const py = halfHeight * sign;
        const pz = radius * cosTheta;

        points.push(px, py, pz);

        normals.push(0, sign, 0);

        const uvU = (cosTheta * 0.5) + 0.5;
        const uvV = (sinTheta * 0.5 * sign) + 0.5;

        uvs.push(uvU, uvV);

        index++;
      }

      for (let x = 0; x < radialSegments; x++) {
        const c = centerIndexStart + x;
        const i = centerIndexEnd + x;

        if (top === true) {
          indices.push(i, i + 1, c);
        } else {
          indices.push(i + 1, i, c);
        }
      }
    }
  }
}
