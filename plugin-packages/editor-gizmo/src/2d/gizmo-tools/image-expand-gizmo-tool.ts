import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { ImageExpandGizmo } from '../gizmos/image-expand-gizmo';

/** 图片扩边工具。 */
export class ImageExpandGizmoTool extends GizmoTool {
  /** @returns 图片扩边 Gizmo 图。 */
  override createGizmos (): Gizmo[] {
    return [new ImageExpandGizmo(this.owner)];
  }
}
