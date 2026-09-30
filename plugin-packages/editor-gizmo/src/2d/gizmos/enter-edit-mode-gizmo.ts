import { MouseButton, spec, TextComponent, type InputEventMouseButton } from '@galacean/effects';
import { GestureCursorType } from '../cursor';
import { Gizmo } from '../gizmo';
import { isEffectsPlayerItem } from '../items';
import { Vector2 } from '../math';
import { EffectsEditMode } from '../modes/effects-edit-mode';
import { TextEditMode } from '../modes/text-edit-mode';

/** 识别可编辑元素的双击，并进入对应的编辑模式。 */
export class EnterEditModeGizmo extends Gizmo {
  readonly type = 'enter-edit-mode';

  /**
   * 双击当前选中的文本或特效元素时进入对应编辑模式。
   * @param event 鼠标按下事件
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left || !event.doubleClick) {
      return;
    }

    const selectedItems = this._owner.getSelection().getSelectedPlayerItems();
    const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined;

    if (!selectedItem) {
      return;
    }

    const selection = this._owner.getSelection();
    const hitIds = selection.filterSelectedItems(
      selection.hitTest(new Vector2(event.position.x, event.position.y)),
    );

    if (!hitIds.includes(selectedItem.getInstanceId())) {
      return;
    }

    if (selectedItem.type === spec.ItemType.text && selectedItem.getComponent(TextComponent)) {
      this._owner.setActiveEditMode(new TextEditMode(this._owner, selectedItem, 'select'));
      this._owner.setCursor({
        type: GestureCursorType.TEXT,
        angle: 0,
      });
    } else if (isEffectsPlayerItem(selectedItem)) {
      this._owner.setActiveEditMode(new EffectsEditMode(
        this._owner,
        selectedItem.getInstanceId(),
      ));
    } else {
      return;
    }

    event.accept();
  }
}
