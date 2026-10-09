import type { Gizmo } from './gizmo';
import type { GizmoOwner } from './gizmo-owner';

/** 创建有序 Gizmo 交互图的工具基类。 */
export class GizmoTool {
  /**
   * @param owner Gizmo 宿主
   */
  constructor (protected owner: GizmoOwner) {}

  /**
   * 创建工具使用的 Gizmo 图。
   * @returns 有序 Gizmo 列表
   */
  createGizmos (): Gizmo[] {
    return [];
  }
}
