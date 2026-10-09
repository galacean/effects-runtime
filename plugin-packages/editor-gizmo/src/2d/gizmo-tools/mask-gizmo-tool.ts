import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { MaskGizmo } from '../gizmos/mask-gizmo';

/** 蒙版编辑工具。 */
export class MaskGizmoTool extends GizmoTool {
  /** @returns 蒙版 Gizmo 图。 */
  override createGizmos (): Gizmo[] {
    return [new MaskGizmo(this.owner)];
  }
}
