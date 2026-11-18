import { spec, type VFXItem } from '@galacean/effects';
import type { GizmoOwner } from '../gizmo-owner';
import type { TextEditActivation } from '../text/text-edit-session';
import { RichTextEditMode } from './rich-text-edit-mode';
import { TextEditMode } from './text-edit-mode';

/** 已校验的文本目标按元素类型进入各自的编辑模式。 */
export function createTextEditMode (owner: GizmoOwner, item: VFXItem, activation: TextEditActivation = 'focus'): TextEditMode | RichTextEditMode {
  return item.type === spec.ItemType.richtext
    ? new RichTextEditMode(owner, item, activation)
    : new TextEditMode(owner, item, activation);
}
