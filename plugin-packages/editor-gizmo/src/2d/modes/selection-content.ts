import { ShapeComponent, type VFXItem } from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';
import type { GizmoOwner } from '../gizmo-owner';
import type { CrystalLatticeGizmo } from '../gizmos/crystal-lattice-gizmo';
import type { GradientGizmo } from '../gizmos/gradient-gizmo';
import { getGradientPaint, isValidGradientPaint } from '../items/shape-editing';

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
  const paint = getGradientPaint(item.getComponent(ShapeComponent), edit.paintKind, edit.paintIndex);

  return isValidGradientPaint(paint) ? item : undefined;
}
