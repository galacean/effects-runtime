import { ShapeComponent, isValidGradientPaint, type VFXItem } from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';
import type { GizmoOwner } from '../gizmo-owner';
import { CrystalLatticeGizmo } from '../gizmos/crystal-lattice-gizmo';
import { GradientGizmo } from '../gizmos/gradient-gizmo';

export type SelectionContentEdit = {
  type: 'lattice',
} | {
  type: 'gradient',
  paintKind: 'fill' | 'stroke',
  paintIndex: number,
};
export type SelectionContentGizmo = CrystalLatticeGizmo | GradientGizmo;

export type SelectionGizmoOptions = {
  showFFDWireframe?: boolean,
  showMotionPath?: boolean,
  showTransformHandles?: boolean,
};

/** 检查编辑目标，不为验证入口创建临时 Gizmo。 */
export function getSelectionContentItem (owner: GizmoOwner, edit: SelectionContentEdit): VFXItem | undefined {
  const items = owner.getSelection().getSelectedPlayerItems();

  if (items.length !== 1) {
    return;
  }
  const item = items[0];

  if (edit.type === 'lattice') {
    return item.getComponent(FFDComponent)?.getLattice().enabled ? item : undefined;
  }
  const paint = item.getComponent(ShapeComponent)?.getGradientPaint(edit.paintKind, edit.paintIndex);

  return isValidGradientPaint(paint) ? item : undefined;
}

/** 只组装现有模式内部的内容工具；不切换动效选择范围。 */
export function createSelectionContentGizmo (owner: GizmoOwner, edit: SelectionContentEdit, exit: () => void,
  onDispose?: (gizmo: SelectionContentGizmo) => void): SelectionContentGizmo | undefined {
  const item = getSelectionContentItem(owner, edit);

  if (!item) {
    return;
  }

  const release = () => onDispose?.(gizmo);
  const gizmo: SelectionContentGizmo = edit.type === 'lattice' ? new CrystalLatticeGizmo(owner, item, exit, release)
    : new GradientGizmo(owner, item, edit.paintKind, edit.paintIndex, exit, release);

  return gizmo;
}
