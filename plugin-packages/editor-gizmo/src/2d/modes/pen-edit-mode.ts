import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { PenGizmo } from '../gizmos/shape/pen-gizmo';
import type { GeometryGizmoHost, HandleMirrorMode, PenNodeSelection, PenToolState } from '../gizmos/shape/geometry';
import type { EditMode } from './edit-mode';

/** One mode for a new path, an appended subpath and existing Bezier nodes. */
export class PenEditMode implements EditMode {
  readonly id = 'pen';
  readonly dimension = 2;
  private gizmo?: PenGizmo;
  private selection: PenNodeSelection[] = [];
  private target?: string;
  private toolState: PenToolState;
  private interactionMode: PenToolState;
  private preserveTarget: boolean;
  private mirrorMode: HandleMirrorMode = 'angle-length';
  private lassoMode = false;

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
      this.selection = [];
      this.target = undefined;
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
    this.selection = [];
    this.owner.rebuildGizmos();
    this.onStateChange?.();
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  createGizmos (): PenGizmo[] {
    const target = (this.interactionMode === 'edit' || this.preserveTarget) ? this.host.readPath()?.itemId : undefined;

    const previousPoint = this.gizmo?.selectedInfo;

    this.selection = (this.interactionMode === 'edit' || this.preserveTarget) && target === this.target && previousPoint
      ? this.gizmo?.selectedPointsInfo ?? this.selection : [];
    this.target = target;
    this.gizmo = new PenGizmo(this.owner, this.host, this.interactionMode, state => {
      if (state === 'create') {
        this.enterEdit();
      } else {
        this.owner.resetEditMode();
      }
    }, this.preserveTarget);
    this.gizmo.setHandleMirrorMode(this.mirrorMode);
    this.gizmo.setLassoMode(this.lassoMode);
    this.gizmo.setSelectedPoints(this.selection);

    return [this.gizmo];
  }

  onExit (): void {
    this.gizmo?.onCancel('mode-exit');
    this.selection = [];
    this.target = undefined;
    this.toolState = 'create';
    this.interactionMode = 'create';
    this.preserveTarget = false;
    this.onModeExit?.();
  }

  setHandleMirrorMode (mode: HandleMirrorMode): void {
    this.mirrorMode = mode;
    this.gizmo?.setHandleMirrorMode(mode);
  }

  setLassoMode (enabled: boolean): void {
    this.lassoMode = enabled;
    this.gizmo?.setLassoMode(enabled);
  }
}
