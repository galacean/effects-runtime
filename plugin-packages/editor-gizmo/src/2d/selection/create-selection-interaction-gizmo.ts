import type { GizmoOwner } from '../gizmo-owner';
import { BoxSelectionGizmo } from '../gizmos/box-selection-gizmo';
import { ChangeSelectionGizmo } from '../gizmos/change-selection-gizmo';
import { ClickDragMultiplexGizmo } from '../gizmos/click-drag-multiplex-gizmo';
import { MoveSelectionGizmo } from '../gizmos/move-selection-gizmo';

/**
 * 创建用于仲裁点击、移动和框选的复合 Gizmo。
 * @param owner Gizmo 宿主。
 * @returns 选区交互复合 Gizmo。
 */
export function createSelectionInteractionGizmo (owner: GizmoOwner): ClickDragMultiplexGizmo {
  return new ClickDragMultiplexGizmo(owner, {
    clickCandidates: [new ChangeSelectionGizmo(owner)],
    dragCandidates: [new MoveSelectionGizmo(owner), new BoxSelectionGizmo(owner)],
    auxiliaryBehavior: new BoxSelectionGizmo(owner, false),
  });
}
