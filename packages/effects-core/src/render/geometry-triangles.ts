import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Geometry } from './geometry';
import { VertexElementType } from './vertex-element-type';

/** 按索引顺序返回几何体的世界坐标三角形。 */
export function getWorldTriangles (geometry: Geometry, worldMatrix: Matrix4): TriangleLike[] {
  const indices = geometry.getIndexData();
  const vertices = geometry.getAttributeData(VertexElementType.Position);
  const triangles: TriangleLike[] = [];

  if (!indices || !vertices) {
    return triangles;
  }

  const vertexCount = Math.floor(vertices.length / 3);
  const worldPoint = (index: number) => {
    const offset = index * 3;

    return worldMatrix.transformPoint(new Vector3(vertices[offset], vertices[offset + 1], vertices[offset + 2]));
  };
  const appendTriangles = (start: number, count: number) => {
    const end = Math.min(start + count, indices.length);

    for (let i = start; i + 2 < end; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];

      if (Math.min(a, b, c) < 0 || Math.max(a, b, c) >= vertexCount) {
        continue;
      }
      triangles.push({ p0: worldPoint(a), p1: worldPoint(b), p2: worldPoint(c) });
    }
  };

  if (geometry.subMeshes.length === 0) {
    appendTriangles(0, indices.length);
  } else {
    for (const { offset, indexCount } of geometry.subMeshes) {
      if (indexCount !== undefined) {
        appendTriangles(offset / indices.BYTES_PER_ELEMENT, indexCount);
      }
    }
  }

  return triangles;
}
