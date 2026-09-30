import { Gizmo } from '../gizmo';
import { MouseButton, type InputEventMouseButton } from '@galacean/effects';

/** 在画布主键按下时退出行内文本编辑。 */
export class LeaveTextEditGizmo extends Gizmo {
  readonly type = 'leave-text-edit';

  /**
   * 处理主键按下并退出编辑模式。
   * @param event 鼠标按下事件
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this._owner.resetEditMode();
    event.accept();
  }
}
