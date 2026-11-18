import type { VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../gizmo-owner';
import { isTextPlayerItem } from '../items';
import type { TextEditSession } from '../text/text-edit-session';
import { SelectTextGizmoBase } from './select-text-gizmo-base';

/** 在普通文本编辑模式下悬停、选择并切换文本对象。 */
export class SelectTextGizmo extends SelectTextGizmoBase {
  readonly type = 'select-text';

  constructor (owner: GizmoOwner, session: TextEditSession) {
    super(owner, session);
  }

  protected isTextItem (item: VFXItem): boolean { return isTextPlayerItem(item); }
}
