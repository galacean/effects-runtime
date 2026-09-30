import { MouseButton, type InputEventMouseButton } from '@galacean/effects';
import { Gizmo } from '../gizmo';
import { Vector2 } from '../math';

/** 点击当前特效范围外的画布空白区域时退出特效编辑。 */
export class LeaveEffectsEditGizmo extends Gizmo {
  readonly type = 'leave-effects-edit';

  /**
   * 在特效范围外的空白区域按下主键时退出编辑模式。
   * @param event 鼠标按下事件
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }

    const point = new Vector2(event.position.x, event.position.y);
    const selection = this._owner.getSelection();

    if (selection.hitTest(point).length > 0 || selection.isPointInEffectsEditScope(point)) {
      return;
    }

    this._owner.resetEditMode();
    event.accept();
  }
}
