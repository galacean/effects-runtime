import type { InputEventMouseButton, VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../gizmo-owner';
import { isEditableTextItem, isRichTextPlayerItem } from '../items';
import type { RichTextEditSession } from '../rich-text/rich-text-edit-session';
import { SelectTextGizmoBase } from './select-text-gizmo-base';

/** 富文本选择保留扩选、选词语义，并只在富文本目标之间切换。 */
export class SelectRichTextGizmo extends SelectTextGizmoBase {
  readonly type = 'select-rich-text';

  constructor (owner: GizmoOwner, private readonly richSession: RichTextEditSession) {
    super(owner, richSession);
  }

  protected isTextItem (item: VFXItem): boolean { return isRichTextPlayerItem(item) && isEditableTextItem(item); }

  protected override beginPointerSelection (event: InputEventMouseButton): object {
    return this.richSession.beginPointerSelection({ x: event.position.x, y: event.position.y },
      { extend: event.shiftPressed, word: event.doubleClick });
  }
}
