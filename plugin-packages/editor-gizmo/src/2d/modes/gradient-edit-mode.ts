import type { VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../gizmo-owner';
import { GradientGizmo } from '../gizmos/gradient-gizmo';
import type { SelectionContentEdit } from './selection-content';
import { SelectionContentEditMode } from './selection-content-edit-mode';

export type GradientEditModeOptions = {
  paintKind?: 'fill' | 'stroke',
  paintIndex?: number,
};

/** 编辑选中图形的渐变填充或描边，管理渐变拖拽的提交与取消。 */
export class GradientEditMode extends SelectionContentEditMode {
  readonly id = 'gradient-edit';
  readonly edit: Extract<SelectionContentEdit, { type: 'gradient' }>;

  constructor (owner: GizmoOwner, options: GradientEditModeOptions = {}, exit?: () => void) {
    super(owner, exit);
    this.edit = { type: 'gradient', paintKind: options.paintKind ?? 'fill', paintIndex: options.paintIndex ?? 0 };
  }

  protected override createContentGizmo (item: VFXItem, onDispose: () => void): GradientGizmo {
    return new GradientGizmo(this.owner, item, this.edit.paintKind, this.edit.paintIndex, this.exit, onDispose);
  }
}
