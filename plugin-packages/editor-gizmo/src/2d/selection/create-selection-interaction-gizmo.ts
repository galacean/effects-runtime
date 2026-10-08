import type { GizmoOwner } from '../gizmo-owner';
import { BoxSelectionGizmo } from '../gizmos/box-selection-gizmo';
import { ChangeSelectionGizmo } from '../gizmos/change-selection-gizmo';
import { ClickDragMultiplexGizmo } from '../gizmos/click-drag-multiplex-gizmo';
import { MoveSelectionGizmo } from '../gizmos/move-selection-gizmo';

/** 选择交互的可选行为。 */
export type SelectionInteractionOptions = {
  /** 是否允许拖拽已选元素进行移动。 */
  allowTransform?: boolean,
};

/**
 * 创建用于仲裁点击、拖拽和框选的复合 Gizmo。
 * @param owner Gizmo 宿主。
 * @param options 选择交互配置。
 * @returns 选区交互复合 Gizmo。
 */
export function createSelectionInteractionGizmo (
  owner: GizmoOwner,
  options: SelectionInteractionOptions = {},
): ClickDragMultiplexGizmo {
  const dragCandidates = options.allowTransform === false
    ? [new BoxSelectionGizmo(owner)]
    : [new MoveSelectionGizmo(owner), new BoxSelectionGizmo(owner)];

  return new ClickDragMultiplexGizmo(owner, {
    clickCandidates: [new ChangeSelectionGizmo(owner)],
    dragCandidates,
    auxiliaryBehavior: new BoxSelectionGizmo(owner, false),
  });
}
