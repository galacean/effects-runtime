import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { ShapeModelGizmo } from '../gizmos/shape/shape-model-gizmo';
import type { GeometryGizmoHost, ShapePrimitive } from '../gizmos/shape/geometry';
import type { EditMode } from './edit-mode';

export class ShapeEditMode implements EditMode {
  readonly id = 'shape';
  readonly dimension = 2;
  private gizmo?: ShapeModelGizmo;

  constructor (private readonly owner: GizmoOwner, private readonly host: GeometryGizmoHost, private primitive: ShapePrimitive = 'rect') {}

  get shape (): ShapePrimitive { return this.primitive; }

  setPrimitive (primitive: ShapePrimitive): void {
    if (primitive === this.primitive) { return; }
    this.gizmo?.onCancel('shape-tool');
    this.primitive = primitive;
    this.owner.rebuildGizmos();
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  createGizmos (): ShapeModelGizmo[] {
    this.gizmo = new ShapeModelGizmo(this.owner, this.host);
    this.gizmo.createType = this.primitive;

    return [this.gizmo];
  }

  onExit (): void { this.gizmo?.onCancel('mode-exit'); }
}
