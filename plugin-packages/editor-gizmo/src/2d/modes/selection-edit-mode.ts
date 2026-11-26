import type { GizmoOwner } from '../gizmo-owner';
import type { Gizmo } from '../gizmo';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { CornerRotationGizmo } from '../gizmos/corner-rotation-gizmo';
import { CurveGizmo } from '../gizmos/curve-gizmo';
import { EnterEditModeGizmo } from '../gizmos/enter-edit-mode-gizmo';
import { FFDWireframeGizmo } from '../gizmos/ffd-wireframe-gizmo';
import { LeaveEffectsEditGizmo } from '../gizmos/leave-effects-edit-gizmo';
import { ResizeSelectionGizmo } from '../gizmos/resize-selection-gizmo';
import { TransformHandlesGizmo } from '../gizmos/transform-handles-gizmo';
import { createSelectionInteractionGizmo } from '../selection/create-selection-interaction-gizmo';
import type { EditMode } from './edit-mode';
import { EffectsEditMode, type EffectsEditModeOptions } from './effects-edit-mode';
import { GradientEditMode } from './gradient-edit-mode';
import { LatticeEditMode } from './lattice-edit-mode';
import type { SelectionContentEdit, SelectionGizmoOptions } from './selection-content';

/** 选区变换工具及可选的动效子树范围。 */
export type SelectionEditModeOptions = SelectionGizmoOptions & EffectsEditModeOptions & {
  /** 省略时编辑根选区，提供时放开指定动效的内部选择范围。 */
  effectsItemId?: string,
};

/** 管理选区变换和选择范围；内容编辑交给对应的渐变或晶格模式。 */
export class SelectionEditMode implements EditMode {
  readonly id = 'selection-edit';
  private readonly effectsMode?: EffectsEditMode;
  private contentMode?: GradientEditMode | LatticeEditMode;

  /**
   * @param owner Gizmo 宿主
   * @param options 选区变换及动效范围配置
   */
  constructor (private readonly owner: GizmoOwner, private readonly options: SelectionEditModeOptions = {}) {
    if (options.effectsItemId) {
      this.effectsMode = new EffectsEditMode(owner, options.effectsItemId, options);
    }
  }

  get effectsItemId (): string | undefined {
    return this.options.effectsItemId;
  }

  get contentEdit (): SelectionContentEdit | undefined {
    return this.contentMode?.edit;
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  onEnter (): void {
    this.effectsMode?.onEnter();
  }

  onExit (): void {
    this.contentMode?.onExit();
    this.effectsMode?.onExit();
  }

  /** 在当前选择范围内切换内容编辑，退出时立即回滚尚未提交的操作。 */
  editContent (edit?: SelectionContentEdit): boolean {
    const exit = () => { this.editContent(); };
    const nextMode = !edit ? undefined : edit.type === 'gradient'
      ? new GradientEditMode(this.owner, edit, exit)
      : new LatticeEditMode(this.owner, exit);

    if (nextMode && (this.options.allowTransform === false || !nextMode.canEdit())) {
      return false;
    }
    this.contentMode?.onExit();
    this.contentMode = nextMode;
    this.owner.rebuildGizmos();

    return true;
  }

  /** 内容模式替换选区变换工具，但不切换动效选择范围。 */
  createGizmos (): Gizmo[] {
    const wireframe = this.options.showFFDWireframe !== false ? [new FFDWireframeGizmo(this.owner)] : [];
    const contentGizmos = this.contentMode?.createGizmos();

    if (contentGizmos?.length) {
      return [...wireframe, ...contentGizmos];
    }
    this.contentMode = undefined;
    const allowTransform = this.options.allowTransform !== false;
    const resize = new ResizeSelectionGizmo(this.owner, { interactive: allowTransform });

    return [
      ...wireframe,
      ...(allowTransform && this.options.showMotionPath !== false ? [new CurveGizmo(this.owner)] : []),
      ...(allowTransform && this.options.showTransformHandles !== false
        ? [new TransformHandlesGizmo(this.owner, resize)]
        : []),
      ...(allowTransform ? [new CornerRotationGizmo(this.owner, resize)] : []),
      resize,
      this.effectsItemId ? new LeaveEffectsEditGizmo(this.owner) : new EnterEditModeGizmo(this.owner),
      createSelectionInteractionGizmo(this.owner, { allowTransform }),
    ];
  }
}
