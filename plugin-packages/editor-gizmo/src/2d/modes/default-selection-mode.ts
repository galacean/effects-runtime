import type { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { CornerRotationGizmo } from '../gizmos/corner-rotation-gizmo';
import { EnterEditModeGizmo } from '../gizmos/enter-edit-mode-gizmo';
import { ResizeSelectionGizmo } from '../gizmos/resize-selection-gizmo';
import { createSelectionInteractionGizmo } from '../selection/create-selection-interaction-gizmo';
import type { EditMode } from './edit-mode';

/** 提供默认选区切换、移动、缩放和旋转交互的编辑模式。 */
export class DefaultSelectionMode implements EditMode {
  readonly id = 'default-selection';

  /** @param owner Gizmo 宿主 */
  constructor (private readonly owner: GizmoOwner) {}

  /**
   * 判断目标工具是否可复用当前模式。
   * @param tool 目标工具
   * @returns 是否保持当前模式
   */
  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  /** @returns 默认选区交互的 Gizmo 图。 */
  createGizmos (): Gizmo[] {
    const resizeSelection = new ResizeSelectionGizmo(this.owner);
    const cornerRotation = new CornerRotationGizmo(this.owner, resizeSelection);

    return [
      cornerRotation,
      resizeSelection,
      new EnterEditModeGizmo(this.owner),
      createSelectionInteractionGizmo(this.owner),
    ];
  }
}
