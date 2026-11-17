import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { PenGizmo } from '../gizmos/shape/pen-gizmo';
import type { GeometryGizmoHost, HandleMirrorMode, PenToolState } from '../gizmos/shape/geometry';
import { createPenEditContext } from '../gizmos/shape/pen-edit-context';
import type { EditMode } from './edit-mode';

/** One mode for a new path, an appended subpath and existing Bezier nodes. */
export class PenEditMode implements EditMode {
  readonly id = 'pen';
  readonly dimension = 2;
  private gizmo?: PenGizmo;
  private editContext = createPenEditContext();
  private toolState: PenToolState;
  private interactionMode: PenToolState;
  private preserveTarget: boolean;

  constructor (
    private readonly owner: GizmoOwner,
    private readonly host: GeometryGizmoHost,
    state: PenToolState = 'create',
    private readonly onStateChange?: () => void,
    private readonly onModeExit?: () => void,
  ) {
    this.toolState = state;
    this.interactionMode = state;
    this.preserveTarget = state === 'edit';
  }

  get state (): PenToolState { return this.toolState; }

  enterEdit (): void {
    if (this.toolState === 'edit') { return; }
    this.gizmo?.onCancel('pen-edit');
    this.toolState = 'edit';
    this.interactionMode = 'edit';
    this.preserveTarget = true;
    this.owner.rebuildGizmos();
    this.onStateChange?.();
  }

  enterCreate (preserveTarget = false): void {
    if (this.toolState === 'create' && this.preserveTarget === preserveTarget) { return; }
    this.gizmo?.onCancel('pen-create');
    this.toolState = 'create';
    this.interactionMode = 'create';
    this.preserveTarget = preserveTarget;
    if (!preserveTarget) {
      this.editContext.selected = undefined;
      this.editContext.selectedNodes.clear();
      this.owner.getSelection().commitSelectedItems([]);
    }
    this.owner.rebuildGizmos();
    this.onStateChange?.();
  }

  restartCreate (): void {
    this.gizmo?.onCancel('pen-close');
    this.toolState = 'create';
    this.interactionMode = 'create';
    this.preserveTarget = true;
    this.editContext.selected = undefined;
    this.editContext.selectedNodes.clear();
    this.owner.rebuildGizmos();
    this.onStateChange?.();
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  createGizmos (): PenGizmo[] {
    this.gizmo = new PenGizmo(this.owner, this.host, this.interactionMode, state => {
      if (state === 'create') {
        this.enterEdit();
      } else {
        this.owner.resetEditMode();
      }
    }, this.preserveTarget, this.editContext);
    this.gizmo.onUpdate();

    return [this.gizmo];
  }

  onExit (): void {
    this.gizmo?.onCancel('mode-exit');
    this.editContext = createPenEditContext();
    this.toolState = 'create';
    this.interactionMode = 'create';
    this.preserveTarget = false;
    this.onModeExit?.();
  }

  setHandleMirrorMode (mode: HandleMirrorMode): void {
    this.editContext.mirrorMode = mode;
  }

  setLassoMode (enabled: boolean): void {
    this.editContext.lassoMode = enabled;
    this.gizmo?.setLassoMode(enabled);
  }
}
