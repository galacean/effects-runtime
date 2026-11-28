import type { VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import type { EditMode } from './edit-mode';
import { getSelectionContentItem, type SelectionContentEdit, type SelectionContentGizmo } from './selection-content';

/** 内容模式共用的捕获生命周期；选择范围由外层选区模式管理。 */
export abstract class SelectionContentEditMode implements EditMode {
  abstract readonly id: string;
  abstract readonly edit: SelectionContentEdit;
  /** 图重建不会立即释放被捕获的 Gizmo，退出时仍须取消其未提交操作。 */
  private readonly gizmos = new Set<SelectionContentGizmo>();
  private exitTimeout?: ReturnType<typeof setTimeout>;

  constructor (
    protected readonly owner: GizmoOwner,
    protected readonly exit: () => void = () => owner.resetEditMode(),
  ) {}

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  /** 检查当前选择是否可编辑，不创建临时 Gizmo。 */
  canEdit (): boolean {
    return !!getSelectionContentItem(this.owner, this.edit);
  }

  createGizmos (): SelectionContentGizmo[] {
    const item = getSelectionContentItem(this.owner, this.edit);

    if (!item) {
      this.onExit();
      if (this.owner.getActiveEditMode() === this) {
        // 当前重建完成后再退出，避免空结果覆盖新模式的 Gizmo。
        this.exitTimeout = setTimeout(() => {
          this.exitTimeout = undefined;
          if (this.owner.getActiveEditMode() === this && !this.canEdit()) {
            this.exit();
          }
        }, 0);
      }

      return [];
    }
    const gizmo = this.createContentGizmo(item, () => { this.gizmos.delete(gizmo); });

    this.gizmos.add(gizmo);

    return [gizmo];
  }

  onExit (): void {
    clearTimeout(this.exitTimeout);
    this.exitTimeout = undefined;
    const gizmos = Array.from(this.gizmos);

    this.gizmos.clear();
    gizmos.forEach(gizmo => gizmo.cancelInteraction());
  }

  protected abstract createContentGizmo (item: VFXItem, onDispose: () => void): SelectionContentGizmo;
}
