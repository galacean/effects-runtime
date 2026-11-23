import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { isSpatialEditMode } from '../modes/spatial-edit-mode';

/** 画布平移工具。 */
export class HandGizmoTool extends GizmoTool {
  override createGizmos (): Gizmo[] {
    const mode = this.owner.getActiveEditMode();

    return isSpatialEditMode(mode) ? mode.createGizmos() : [];
  }
}
