import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { ItemCreateGizmo, ItemCreateType } from '../gizmos/item-create-gizmo';

/** 元素创建工具。 */
export class ItemCreateGizmoTool extends GizmoTool {
  /** 当前元素创建类型。 */
  createType: ItemCreateType = ItemCreateType.NONE;

  /** @returns 指定创建类型的 Gizmo 图。 */
  override createGizmos (): Gizmo[] {
    const gizmo = new ItemCreateGizmo(this.owner);

    gizmo.createType = this.createType;

    return [gizmo];
  }
}
