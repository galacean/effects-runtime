import { vecNormalize, vecSub } from '../math/vec';
import { GeometryData } from './geometry';

/**
 *
 */
export class TorusGeometryData extends GeometryData {
  /**
   *
   * @param radius
   * @param tube
   * @param radialSegments
   * @param tubularSegments
   * @param arc
   */
  constructor (
    radius = 1,
    tube = 0.4,
    radialSegments = 64,
    tubularSegments = 64,
    arc = Math.PI * 2,
  ) {
    super();

    radialSegments = Math.floor(radialSegments);
    tubularSegments = Math.floor(tubularSegments);

    for (let j = 0; j <= radialSegments; j++) {
      for (let i = 0; i <= tubularSegments; i++) {

        const u = i / tubularSegments * arc;
        const v = j / radialSegments * Math.PI * 2;

        const px = (radius + tube * Math.cos(v)) * Math.cos(u);
        const py = (radius + tube * Math.cos(v)) * Math.sin(u);
        const pz = tube * Math.sin(v);

        this.points.push(px, py, pz);

        const cx = radius * Math.cos(u);
        const cy = radius * Math.sin(u);
        const normal = vecNormalize(vecSub([], [px, py, pz], [cx, cy, 0]));

        this.normals.push(...normal);

        this.uvs.push(i / tubularSegments);
        this.uvs.push(j / radialSegments);
      }
    }

    for (let j = 1; j <= radialSegments; j++) {
      for (let i = 1; i <= tubularSegments; i++) {
        const a = (tubularSegments + 1) * j + i - 1;
        const b = (tubularSegments + 1) * (j - 1) + i - 1;
        const c = (tubularSegments + 1) * (j - 1) + i;
        const d = (tubularSegments + 1) * j + i;

        this.indices.push(a, b, d);
        this.indices.push(b, c, d);
      }
    }
  }
}
