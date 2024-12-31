import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import type { Geometry } from '../../render/geometry';
import type { BoundingBoxTriangle } from './click-handler';
import { HitTestType } from './click-handler';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

/**
 *
 */
export class MeshCollider {
  private boundingBoxData: BoundingBoxTriangle;
  private geometry: Geometry;
  private triangles: TriangleLike[] = [];
  private worldMatrix = new Matrix4();

  getBoundingBoxData (): BoundingBoxTriangle {
    this.applyWorldMatrix(this.boundingBoxData.area);

    return this.boundingBoxData;
  }

  getBoundingBox (): BoundingBoxTriangle {
    let maxX = -Number.MAX_VALUE;
    let maxY = -Number.MAX_VALUE;

    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;

    for (const triangle of this.boundingBoxData.area) {
      maxX = Math.max(triangle.p0.x, triangle.p1.x, triangle.p2.x, maxX);
      maxY = Math.max(triangle.p0.y, triangle.p1.y, triangle.p2.y, maxY);
      minX = Math.min(triangle.p0.x, triangle.p1.x, triangle.p2.x, minX);
      minY = Math.min(triangle.p0.y, triangle.p1.y, triangle.p2.y, minY);
    }

    const area = [];

    const point0 = new Vector3(minX, maxY, 0);
    const point1 = new Vector3(maxX, maxY, 0);
    const point2 = new Vector3(maxX, minY, 0);
    const point3 = new Vector3(minX, minY, 0);

    area.push({ p0: point0, p1: point1, p2: point2 });
    area.push({ p0: point0, p1: point2, p2: point3 });

    this.applyWorldMatrix(area);

    return {
      type: HitTestType.triangle,
      area,
    };
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
      this.worldMatrix.copyFrom(worldMatrix);
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

  private applyWorldMatrix (area: TriangleLike[]) {
    area.forEach(triangle => {
      triangle.p0 = this.worldMatrix.transformPoint(triangle.p0 as Vector3, new Vector3());
      triangle.p1 = this.worldMatrix.transformPoint(triangle.p1 as Vector3, new Vector3());
      triangle.p2 = this.worldMatrix.transformPoint(triangle.p2 as Vector3, new Vector3());
    });

    return area;
  }
}
