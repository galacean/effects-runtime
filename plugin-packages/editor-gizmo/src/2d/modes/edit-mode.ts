import type { Gizmo } from '../gizmo';
import type { GizmoTool } from '../gizmo-tool';

/** 工具内部可持续存在的编辑模式。 */
export interface EditMode {
  /** 编辑模式唯一标识。 */
  readonly id: string,

  /**
   * 判断切换工具后是否可保持当前模式。
   * @param tool 目标工具
   */
  canRemainActiveForTool(tool: GizmoTool): boolean,

  /** 创建当前模式的 Gizmo 图。 */
  createGizmos(): Gizmo[],

  /** 进入模式。 */
  onEnter?(): void,

  /** 退出模式。 */
  onExit?(): void,
}
