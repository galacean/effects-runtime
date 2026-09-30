import type { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { CornerRotationGizmo } from '../gizmos/corner-rotation-gizmo';
import { LeaveEffectsEditGizmo } from '../gizmos/leave-effects-edit-gizmo';
import { ResizeSelectionGizmo } from '../gizmos/resize-selection-gizmo';
import { getPlayerItemById } from '../items';
import { createSelectionInteractionGizmo } from '../selection/create-selection-interaction-gizmo';
import type { EditMode } from './edit-mode';

/** 在单个特效容器内提供子元素选择和变换交互。 */
export class EffectsEditMode implements EditMode {
  readonly id = 'effects-edit';

  /**
   * @param owner Gizmo 宿主
   * @param effectsItemId 正在编辑的特效容器实例 ID
   */
  constructor (
    private readonly owner: GizmoOwner,
    readonly effectsItemId: string,
  ) {}

  /**
   * 判断目标工具是否可复用当前特效编辑会话。
   * @param tool 目标工具
   * @returns 是否保持当前模式
   */
  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  /** 放开当前特效容器的子树选择边界。 */
  onEnter (): void {
    this.owner.getSelection().enterEffectsEditScope(this.effectsItemId);
  }

  /** 关闭特效子树选择边界，并恢复选中特效容器。 */
  onExit (): void {
    const selection = this.owner.getSelection();

    selection.leaveEffectsEditScope();
    if (getPlayerItemById(this.owner.getEngine().sceneServer.compositions[0], this.effectsItemId)) {
      selection.commitSelectedItems([this.effectsItemId]);
    } else {
      selection.clearSelectedItems();
    }
  }

  /** @returns 特效内部编辑使用的 Gizmo 图。 */
  createGizmos (): Gizmo[] {
    const resizeSelection = new ResizeSelectionGizmo(this.owner);
    const cornerRotation = new CornerRotationGizmo(this.owner, resizeSelection);

    return [
      cornerRotation,
      resizeSelection,
      new LeaveEffectsEditGizmo(this.owner),
      createSelectionInteractionGizmo(this.owner),
    ];
  }
}
