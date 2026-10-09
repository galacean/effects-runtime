import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { ImageCutGizmo } from '../gizmos/image-cut-gizmo';

/** 图片裁切工具。 */
export class ImageCutGizmoTool extends GizmoTool {
  /** @returns 图片裁切 Gizmo 图。 */
  override createGizmos (): Gizmo[] {
    return [new ImageCutGizmo(this.owner)];
  }
}
