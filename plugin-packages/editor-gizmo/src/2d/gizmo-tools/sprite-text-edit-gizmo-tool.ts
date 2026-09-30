import type { Gizmo } from '../gizmo';
import { GizmoTool } from '../gizmo-tool';
import { SpriteTextEditGizmo } from '../gizmos/sprite-text-edit-gizmo';

/** Sprite 精准文字编辑工具。 */
export class SpriteTextEditGizmoTool extends GizmoTool {
  /** @returns 精准文字编辑 Gizmo 图。 */
  override createGizmos (): Gizmo[] {
    return [new SpriteTextEditGizmo(this.owner)];
  }
}
