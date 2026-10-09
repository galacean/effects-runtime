import type { Gizmo } from './gizmo';
import type { HandGizmo } from './gizmos/hand-gizmo';
import type { IconGizmo } from './gizmos/icon-gizmo';
import type { ItemCreateGizmo } from './gizmos/item-create-gizmo';
import type { LoadingGizmo } from './gizmos/loading-gizmo';
import type { MaskGizmo } from './gizmos/mask-gizmo';
import type { ImageCutGizmo } from './gizmos/image-cut-gizmo';
import type { ImageExpandGizmo } from './gizmos/image-expand-gizmo';
import type { ViewportOverlayGizmo } from './gizmos/viewport-overlay-gizmo';
import type { SpriteTextEditGizmo } from './gizmos/sprite-text-edit-gizmo';
import type { TextGizmo } from './gizmos/text-gizmo';
import type { ResizeSelectionGizmo } from './gizmos/resize-selection-gizmo';
import type { ChangeSelectionGizmo } from './gizmos/change-selection-gizmo';
import type { MoveSelectionGizmo } from './gizmos/move-selection-gizmo';
import type { BoxSelectionGizmo } from './gizmos/box-selection-gizmo';
import type { ClickDragMultiplexGizmo } from './gizmos/click-drag-multiplex-gizmo';
import { ConfigManager } from './configs/config-manager';
import type { LeaveTextEditGizmo } from './gizmos/leave-text-edit-gizmo';
import type { EnterEditModeGizmo } from './gizmos/enter-edit-mode-gizmo';
import type { LeaveEffectsEditGizmo } from './gizmos/leave-effects-edit-gizmo';
import type { CornerRotationGizmo } from './gizmos/corner-rotation-gizmo';

/** 当前交互图中可按类型查询的内置 Gizmo 映射。 */
export type GizmoTypeMap = {
  /** 选区切换 Gizmo。 */
  'change-selection': ChangeSelectionGizmo,
  /** 选区移动 Gizmo。 */
  'move-selection': MoveSelectionGizmo,
  /** 框选 Gizmo。 */
  'box-selection': BoxSelectionGizmo,
  /** 点击与拖拽仲裁 Gizmo。 */
  'click-drag-multiplex': ClickDragMultiplexGizmo,
  /** 角点旋转 Gizmo。 */
  'corner-rotation': CornerRotationGizmo,
  /** 视口平移 Gizmo。 */
  hand: HandGizmo,
  /** 媒体图标 Gizmo。 */
  icon: IconGizmo,
  /** 元素创建 Gizmo。 */
  'item-create': ItemCreateGizmo,
  /** 加载状态 Gizmo。 */
  loading: LoadingGizmo,
  /** 蒙版编辑 Gizmo。 */
  mask: MaskGizmo,
  /** 图片裁切 Gizmo。 */
  'image-cut': ImageCutGizmo,
  /** 图片扩边 Gizmo。 */
  'image-expand': ImageExpandGizmo,
  /** 视口覆盖层 Gizmo。 */
  'viewport-overlay': ViewportOverlayGizmo,
  /** 精准文字编辑 Gizmo。 */
  'sprite-text-edit': SpriteTextEditGizmo,
  /** 文本编辑 Gizmo。 */
  text: TextGizmo,
  /** 选区缩放 Gizmo。 */
  'resize-selection': ResizeSelectionGizmo,
  /** 文本编辑退出 Gizmo。 */
  'leave-text-edit': LeaveTextEditGizmo,
  /** 子编辑模式进入 Gizmo。 */
  'enter-edit-mode': EnterEditModeGizmo,
  /** 特效编辑退出 Gizmo。 */
  'leave-effects-edit': LeaveEffectsEditGizmo,
};

/** Gizmo 错误上报阶段。 */
export type GizmoErrorPhase =
  | 'gizmo-init'
  | 'gizmo-actionstart'
  | 'gizmo-actionupdate'
  | 'gizmo-actioncommit'
  | 'gizmo-key'
  | 'gizmo-draw';

/**
 * Gizmo 错误处理函数。
 * @param error 原始错误
 * @param phase 错误阶段
 * @param gizmoType 相关 Gizmo 类型
 */
export type GizmoDispatchErrorHandler = (
  error: unknown,
  phase: GizmoErrorPhase,
  gizmoType?: string,
) => void;

/** 管理当前交互图中的 Gizmo 实例和配置。 */
export class GizmoManager {
  /** Gizmo 配置管理器。 */
  readonly configs = new ConfigManager();

  private _activeGizmos: Gizmo[] = [];

  /** 当前交互图的顶层 Gizmo。 */
  get activeGizmos (): Gizmo[] {
    return this._activeGizmos;
  }

  /**
   * 替换当前交互图的顶层 Gizmo。
   * @param gizmos 新的有序 Gizmo 列表
   */
  set activeGizmos (gizmos: Gizmo[]) {
    this._activeGizmos = [...gizmos];
  }

  /**
   * 按类型获取首个活动 Gizmo。
   * @param type Gizmo 类型
   * @returns 匹配的 Gizmo；不存在时返回 undefined
   */
  get<K extends keyof GizmoTypeMap> (type: K): GizmoTypeMap[K] | undefined;
  get (type: string): Gizmo | undefined;
  get (type: string): Gizmo | undefined {
    return this.findGizmosByType(type)[0];
  }

  /** 按宿主声明顺序执行当前图所有实例的每帧更新。 */
  onUpdate (): void {
    for (const gizmo of this._activeGizmos) {
      gizmo.onUpdate();
    }
  }

  /** 销毁当前交互图。 */
  dispose (): void {
    for (const gizmo of this._activeGizmos) {
      gizmo.dispose();
    }
    this._activeGizmos = [];
  }

  /**
   * 查找指定类型的全部活动 Gizmo。
   * @param type Gizmo 类型
   * @returns 匹配的 Gizmo 列表
   */
  private findGizmosByType (type: string): Gizmo[] {
    return this.getAllManagedGizmos()
      .filter(gizmo => gizmo.type === type);
  }

  /** 获取去重后的全部受管 Gizmo。 */
  private getAllManagedGizmos (): Gizmo[] {
    return Array.from(new Set([
      ...this._activeGizmos,
      ...this.getMultiplexCandidates(),
    ]));
  }

  /** 获取点击与拖拽仲裁器托管的全部候选。 */
  private getMultiplexCandidates (): Gizmo[] {
    const multiplex = this._activeGizmos.find(gizmo => gizmo.type === 'click-drag-multiplex') as ClickDragMultiplexGizmo;

    if (!multiplex) {
      return [];
    }
    const auxiliary = multiplex.auxiliaryBehavior();

    return Array.from(new Set([
      ...multiplex.clickCandidates(),
      ...multiplex.dragCandidates(),
      ...(auxiliary ? [auxiliary] : []),
    ]));
  }
}
