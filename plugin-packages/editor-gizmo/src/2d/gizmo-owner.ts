import type { Vector2 } from './math';
import type { FrameManager } from './frame/frame-manager';
import type { Selection } from './selection/selection';
import type { GizmoManager } from './gizmo-manager';
import type { ConfigManager } from './configs/config-manager';
import type { SnapManager } from './selection/snap-manager';
import type { Engine } from '@galacean/effects';
import type { ViewportNavigationController } from './viewport';
import type { GizmoOwnerEvents } from './gizmo-action';
import type { LoadingManager } from './gizmos/loading-manager';
import type { GestureCursorResult } from './cursor';
import type { EditMode } from './modes';

/** 独立于指针捕获者的选区变换状态。 */
export type SelectionTransformKind = 'idle' | 'move' | 'resize';

/** Gizmo 访问宿主输入、选区、视口和共享服务的接口。 */
export interface GizmoOwner {
  /**
   * 发出 Gizmo 业务事件。
   * @param eventName 事件名称
   * @param args 事件参数
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  emit<E extends keyof GizmoOwnerEvents & string>(eventName: E, ...args: GizmoOwnerEvents[E]): void,

  /** 获取选区状态和命中查询器。 */
  getSelection(): Selection,

  /** 获取画板数据和投影视图。 */
  getFrameManager(): FrameManager,

  /** 获取选区吸附管理器。 */
  getSnapManager(): SnapManager,

  /** 获取加载状态管理器。 */
  getLoadingManager(): LoadingManager,

  /** 获取视口导航控制器。 */
  getViewportNavigation(): ViewportNavigationController,

  /** 获取当前选区变换类型。 */
  getSelectionTransformKind(): SelectionTransformKind,

  /**
   * 设置当前选区变换类型。
   * @param kind 变换类型
   */
  setSelectionTransformKind(kind: SelectionTransformKind): void,

  /** 获取缓存的鼠标视图坐标。 */
  getMousePosition(): Vector2,

  /**
   * 设置当前 Gizmo 光标。
   * @param result 光标样式
   */
  setCursor(result: GestureCursorResult): void,

  /** 判断当前工具是否为视口平移工具。 */
  isHandToolMode(): boolean,

  /** 判断当前是否有鼠标按钮按下。 */
  isMouseButtonPressed(): boolean,

  /** 获取当前激活的编辑模式。 */
  getActiveEditMode(): EditMode,

  /** 切换当前编辑模式。 */
  setActiveEditMode(mode: EditMode): void,

  /** 恢复默认编辑模式。 */
  resetEditMode(): void,

  /** 重建当前工具和编辑模式的 Gizmo 图。 */
  rebuildGizmos(): void,

  /** 获取 Gizmo 管理器。 */
  getGizmoManager(): GizmoManager,

  /** 获取 Effects 引擎。 */
  getEngine(): Engine,

  /** 获取 Gizmo 配置管理器。 */
  getConfigManager(): ConfigManager,
}
