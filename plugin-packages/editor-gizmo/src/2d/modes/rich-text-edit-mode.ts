import type { VFXItem } from '@galacean/effects';
import type { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { RichTextGizmo } from '../gizmos/rich-text-gizmo';
import { SelectRichTextGizmo } from '../gizmos/select-rich-text-gizmo';
import { LeaveTextEditGizmo } from '../gizmos/leave-text-edit-gizmo';
import { RichTextEditSession, type RichTextEditActivation } from '../rich-text/rich-text-edit-session';
import type { RichTextFormat, RichTextSelectionFormats } from '../rich-text/rich-text-editor';
import type { EditMode } from './edit-mode';

/** 富文本独立拥有输入会话和局部格式能力。 */
export class RichTextEditMode implements EditMode {
  readonly id = 'rich-text-edit';
  readonly session: RichTextEditSession;

  constructor (
    private readonly owner: GizmoOwner,
    private readonly target: VFXItem,
    private readonly activation: RichTextEditActivation = 'focus',
  ) {
    this.session = new RichTextEditSession(owner);
  }

  get editingItem (): VFXItem | undefined { return this.session.editingItem; }
  get hasSelection (): boolean { return this.session.hasSelection; }
  get selectionFormats (): RichTextSelectionFormats | undefined { return this.session.selectionFormats; }

  formatSelection (attribute: RichTextFormat, value?: string | null): boolean {
    return this.session.formatSelection(attribute, value);
  }

  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  onEnter (): void {
    if (this.session.retarget(this.target, this.activation)) {
      this.owner.getSelection().commitSelectedItems([this.target.getInstanceId()]);
    }
  }

  onExit (): void { this.session.dispose(); }

  createGizmos (): Gizmo[] {
    return [new RichTextGizmo(this.owner, this.session), new SelectRichTextGizmo(this.owner, this.session), new LeaveTextEditGizmo(this.owner)];
  }
}
