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
import {
  createSelectionContentGizmo,
  getSelectionContentItem,
  type SelectionContentEdit,
  type SelectionContentGizmo,
  type SelectionGizmoOptions,
} from './selection-content';

/** 可独立启用完整编辑能力，也可限定在单个动效子树内。 */
export type BasicEditModeOptions = SelectionGizmoOptions & EffectsEditModeOptions & {
  /** 省略时编辑根选区，提供时放开指定动效的内部选择范围。 */
  effectsItemId?: string,
};

/** 独立装配选区变换、运动路径、FFD 和渐变编辑，并管理动效选择范围。 */
export class BasicEditMode implements EditMode {
  readonly id = 'basic-edit';
  contentEdit?: SelectionContentEdit;
  private readonly effectsMode?: EffectsEditMode;
  /** 保留图重建后仍被捕获的实例，直到宿主实际释放。 */
  private readonly contentGizmos = new Set<SelectionContentGizmo>();

  /**
   * @param owner Gizmo 宿主
   * @param options 完整编辑能力及动效范围配置
   */
  constructor (private readonly owner: GizmoOwner, private readonly options: BasicEditModeOptions = {}) {
    if (options.effectsItemId) {
      this.effectsMode = new EffectsEditMode(owner, options.effectsItemId, options);
    }
  }

  get effectsItemId (): string | undefined {
    return this.options.effectsItemId;
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  onEnter (): void {
    this.effectsMode?.onEnter();
  }

  onExit (): void {
    this.cancelContentInteractions();
    this.effectsMode?.onExit();
  }

  /** 在当前选择范围内切换内容编辑，退出时立即回滚尚未提交的操作。 */
  editContent (edit?: SelectionContentEdit): boolean {
    if (edit && (this.options.allowTransform === false || !getSelectionContentItem(this.owner, edit))) {
      return false;
    }
    this.cancelContentInteractions();
    this.contentEdit = edit;
    this.owner.rebuildGizmos();

    return true;
  }

  /** 按命中优先级创建完整工具列表，当前捕获者仍由宿主负责释放。 */
  createGizmos (): Gizmo[] {
    const wireframe = this.options.showFFDWireframe !== false ? [new FFDWireframeGizmo(this.owner)] : [];
    const contentGizmo = this.contentEdit && createSelectionContentGizmo(
      this.owner,
      this.contentEdit,
      () => this.editContent(),
      gizmo => {
        this.contentGizmos.delete(gizmo);
      },
    );

    if (contentGizmo) {
      this.contentGizmos.add(contentGizmo);

      return [...wireframe, contentGizmo];
    }
    this.cancelContentInteractions();
    this.contentEdit = undefined;
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

  private cancelContentInteractions (): void {
    const gizmos = Array.from(this.contentGizmos);

    this.contentGizmos.clear();
    gizmos.forEach(gizmo => gizmo.cancelInteraction());
  }
}
