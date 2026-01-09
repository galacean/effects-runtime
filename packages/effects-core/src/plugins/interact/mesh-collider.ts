import type { TypedArray } from '@galacean/effects-specification';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Geometry } from '../../render/geometry';
import type { BoundingBoxTriangle } from './click-handler';
import { HitTestType } from './click-handler';
import type { Vector2 } from '@galacean/effects-math/es/core';
import { BoundingBox } from '../../culling/bounding-box';

/**
 * 包围盒信息
 */
export class BoundingBoxInfo {
  /**
   * 包围盒
   */
  readonly boundingBox = new BoundingBox(new Vector3(), new Vector3());

  private triangles: TriangleLike[] = [];
  private boundingBoxTriangle: BoundingBoxTriangle;
  private worldMatrix = new Matrix4();

  /**
   * 重新构建包围盒信息
   * @param min - 新的最小点（局部空间）
   * @param max - 新的最大点（局部空间）
   * @param worldMatrix - 新的世界矩阵
   */
  reConstruct (min: Vector3, max: Vector3, worldMatrix?: Matrix4) {
    this.boundingBox.reConstruct(min, max, worldMatrix);
  }

  /**
   * @deprecated
   */
  getRawBoundingBoxTriangle (): BoundingBoxTriangle {
    this.applyWorldMatrix(this.boundingBoxTriangle.area);

    return this.boundingBoxTriangle;
  }

  /**
   * @deprecated
   */
  getBoundingBoxTriangle (size?: Vector2): BoundingBoxTriangle {
    let maxX = -Number.MAX_VALUE;
    let maxY = -Number.MAX_VALUE;

    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;

    for (const triangle of this.boundingBoxTriangle.area) {
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

  /**
   * @deprecated
   */
  setGeometry (geometry: Geometry, worldMatrix?: Matrix4) {
    this.triangles = this.geometryToTriangles(geometry);
    const area = [];

    for (const triangle of this.triangles) {
      area.push({ p0: triangle.p0, p1: triangle.p1, p2: triangle.p2 });
    }
    if (worldMatrix) {
      this.worldMatrix.copyFrom(worldMatrix);
    }

    this.boundingBoxTriangle = {
      type: HitTestType.triangle,
      area,
    };
  }

  private geometryToTriangles (geometry: Geometry) {
    const indices = geometry.getIndexData();
    const vertices = geometry.getAttributeData('aPos');
    const res: TriangleLike[] = [];

    if (!indices || !vertices) {
      return res;
    }

    if (geometry.subMeshes.length === 0) {
      this.assemblyTriangles(vertices, indices, 0, indices.length, res);
    } else {
      for (const subMesh of geometry.subMeshes) {
        if (subMesh.indexCount === undefined) {
          continue;
        }

        const elementSize = indices.BYTES_PER_ELEMENT;
        const start = subMesh.offset / elementSize;
        const end = start + subMesh.indexCount;

        this.assemblyTriangles(vertices, indices, start, end, res);
      }
    }

    return res;
  }

  private assemblyTriangles = (vertices: TypedArray, indices: TypedArray, indexStart: number, indexEnd: number, res: TriangleLike[]) => {
    for (let i = indexStart; i < indexEnd; i += 3) {
      const index0 = indices[i] * 3;
      const index1 = indices[i + 1] * 3;
      const index2 = indices[i + 2] * 3;
      const p0 = { x: vertices[index0], y: vertices[index0 + 1], z: vertices[index0 + 2] };
      const p1 = { x: vertices[index1], y: vertices[index1 + 1], z: vertices[index1 + 2] };
      const p2 = { x: vertices[index2], y: vertices[index2 + 1], z: vertices[index2 + 2] };

      res.push({ p0, p1, p2 });
    }
  };

  private applyWorldMatrix (area: TriangleLike[]) {
    area.forEach(triangle => {
      triangle.p0 = this.worldMatrix.transformPoint(triangle.p0 as Vector3, new Vector3());
      triangle.p1 = this.worldMatrix.transformPoint(triangle.p1 as Vector3, new Vector3());
      triangle.p2 = this.worldMatrix.transformPoint(triangle.p2 as Vector3, new Vector3());
    });

    return area;
  }
}