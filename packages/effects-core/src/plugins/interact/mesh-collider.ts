import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import type { Geometry } from '../../render/geometry';
import type { BoundingBoxTriangle } from './click-handler';
import { HitTestType } from './click-handler';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

/**
 *
 */
export class MeshCollider {
  private boundingBoxData: BoundingBoxTriangle;
  private geometry: Geometry;
  private triangles: TriangleLike[] = [];

  getBoundingBoxData (): BoundingBoxTriangle {
    return this.boundingBoxData;
  }

  setGeometry (geometry: Geometry, worldMatrix?: Matrix4) {
    if (this.geometry !== geometry) {
      this.triangles = this.geometryToTriangles(geometry);
      this.geometry = geometry;
    }
    const area = [];

    for (const triangle of this.triangles) {
      area.push({ p0: triangle.p0, p1: triangle.p1, p2: triangle.p2 });
    }

    if (worldMatrix) {
      area.forEach(triangle => {
        triangle.p0 = worldMatrix.transformPoint(triangle.p0 as Vector3, new Vector3());
        triangle.p1 = worldMatrix.transformPoint(triangle.p1 as Vector3, new Vector3());
        triangle.p2 = worldMatrix.transformPoint(triangle.p2 as Vector3, new Vector3());
      });
    }

    this.boundingBoxData = {
      type: HitTestType.triangle,
      area,
    };
  }

  private geometryToTriangles (geometry: Geometry) {
    const indices = geometry.getIndexData() ?? [];
    const vertices = geometry.getAttributeData('aPos') ?? [];
    const res: TriangleLike[] = [];

    for (let i = 0; i < indices.length; i += 3) {
      const index0 = indices[i] * 3;
      const index1 = indices[i + 1] * 3;
      const index2 = indices[i + 2] * 3;
      const p0 = { x: vertices[index0], y: vertices[index0 + 1], z: vertices[index0 + 2] };
      const p1 = { x: vertices[index1], y: vertices[index1 + 1], z: vertices[index1 + 2] };
      const p2 = { x: vertices[index2], y: vertices[index2 + 1], z: vertices[index2 + 2] };

      res.push({ p0, p1, p2 });
    }

    return res;
  }
}
