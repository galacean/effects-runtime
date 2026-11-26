import { SpriteComponent, VertexElementType, type Geometry } from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import { GizmoType } from '../gizmo-type';
import type { Vector2 } from '../../math';
import { Vector3 } from '../../math';
import { toColor } from '../drawing';
import { ffdWireframeConfig } from '../configs/builtin-configs';
import { projectPoint } from '../viewport';
import { viewportSize } from './content-edit-utils';

/** 读取 CPU 基础网格，严格遵守属性布局和有效绘制区间。 */
export function wireframeTriangles (geometry: Geometry): Vector3[][] {
  const view = geometry.getVertexBuffer(VertexElementType.Position);
  const data = geometry.getAttributeData(VertexElementType.Position);

  if (!view || !(data instanceof Float32Array) || view.size < 2 || view.type !== 5126) {
    return [];
  }
  const stride = (view.byteStride || view.size * 4) / 4;
  const offset = view.byteOffset / 4;
  const count = Math.max(0, Math.floor((data.length - offset - view.size) / stride) + 1);
  const indexData = geometry.getIndexData();
  const indices = indexData.length ? indexData : undefined;
  const subMesh = geometry.subMeshes[0];
  // 索引绘制的偏移以字节为单位，非索引绘制的偏移以顶点为单位。
  const start = (subMesh?.offset ?? geometry.getDrawStart()) / (indices?.BYTES_PER_ELEMENT ?? 1);
  const drawCount = subMesh ? (indices ? subMesh.indexCount ?? 0 : subMesh.vertexCount) : geometry.getDrawCount();
  const length = Math.min(drawCount, (indices?.length ?? count) - start);
  const triangles: Vector3[][] = [];
  const vertices = new Map<number, Vector3>();

  if (!Number.isInteger(start) || start < 0) {
    return triangles;
  }
  for (let i = start; i + 2 < start + length; i += 3) {
    const ids = [0, 1, 2].map(j => indices ? indices[i + j] : i + j);

    if (ids.some(index => index < 0 || index >= count)) {
      continue;
    }
    triangles.push(ids.map(index => {
      const cached = vertices.get(index);

      if (cached) {
        return cached;
      }
      const at = offset + index * stride;
      const point = new Vector3(data[at], data[at + 1], view.size > 2 ? data[at + 2] : 0);

      vertices.set(index, point);

      return point;
    }));
  }

  return triangles;
}

/** 只显示基础三角网格，不占用鼠标输入，也不读取 GPU 变形结果。 */
export class FFDWireframeGizmo extends Gizmo {
  readonly type = GizmoType.FFD_WIREFRAME;

  override draw (control: Control): void {
    const config = this._owner.getConfigManager().get(ffdWireframeConfig);
    const color = toColor(config.lineColor);

    for (const item of this._owner.getSelection().getSelectedPlayerItems()) {
      if (!item.isVisible || !item.getComponent(FFDComponent)) {
        continue;
      }
      const sprite = item.getComponent(SpriteComponent);

      if (!sprite?.geometry) {
        continue;
      }
      const viewport = viewportSize(item);
      const matrix = item.transform.getWorldMatrix();
      const size = item.transform.size;
      const projected = new Map<Vector3, Vector2>();

      // 仅复用本次绘制的共享顶点；下一帧重新读取几何、变换和视口。
      for (const triangle of wireframeTriangles(sprite.geometry)) {
        const points = triangle.map(point => {
          const cached = projected.get(point);

          if (cached) {
            return cached;
          }
          const position = new Vector3(point.x * size.x, point.y * size.y, point.z).applyMatrix(matrix);
          const view = projectPoint(position, item, viewport);

          projected.set(point, view);

          return view;
        });

        control.drawTriangle(
          points[0].x,
          points[0].y,
          points[1].x,
          points[1].y,
          points[2].x,
          points[2].y,
          color,
          config.lineWidth,
        );
      }
    }
  }
}
