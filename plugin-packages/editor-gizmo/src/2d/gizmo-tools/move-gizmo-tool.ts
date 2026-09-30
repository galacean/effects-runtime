import { GizmoTool } from '../gizmo-tool';

/** 使用当前编辑模式处理选区交互的默认工具。 */
export class MoveGizmoTool extends GizmoTool {
  /** @returns 当前编辑模式的 Gizmo 图。 */
  override createGizmos () {
    return this.owner.getActiveEditMode().createGizmos();
  }
}
