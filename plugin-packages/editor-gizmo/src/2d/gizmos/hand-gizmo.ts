import { Gizmo } from '../gizmo';
import { GestureCursorType, type GestureCursorResult } from '../cursor';
import {
  MouseButton,
  type InputEventKey,
  type InputEventMouseButton,
  type InputEventMouseMotion,
} from '@galacean/effects';
import { Vector2 } from '../math';

/** 视口平移交互状态。 */
enum DragType {
  /** 未进行平移。 */
  NONE = 'none',
  /** 正在拖拽平移。 */
  PAN = 'pan',
}

/** 通过中键或抓手模式拖拽平移视口。 */
export class HandGizmo extends Gizmo {
  readonly type = 'hand';

  /** 空格按下时下一次左键拖拽应平移视口。 */
  private panKeyPressed = false;

  /** 当前拖拽会话态（NONE 未建立 / PAN 平移拖拽中）。 */
  private dragType: DragType = DragType.NONE;

  /** 上一帧鼠标位置（拖拽平移增量计算用）。 */
  private lastPoint = new Vector2();

  /** 当前抓手交互对应的光标。 */
  get cursorResult (): GestureCursorResult {
    const armed = this._owner.isHandToolMode() || this.isPanning();
    const type = this.dragType === DragType.PAN
      ? GestureCursorType.ACTIVE_HAND
      : (armed ? GestureCursorType.HAND : GestureCursorType.NORMAL);

    return { type, angle: 0 };
  }

  /** @returns 是否正在平移或等待空格拖拽。 */
  isPanning (): boolean {
    return this.dragType === DragType.PAN || this.panKeyPressed;
  }

  /**
   * 处理空格键按下并进入待平移状态。
   * @param event 键盘按下事件。
   */
  override onKeyDown (event: InputEventKey): void {
    const code = event.physicalKeycode.toLocaleLowerCase();

    if (code === 'space') {
      if (this.panKeyPressed) {
        event.accept();
      } else if (!this._owner.isMouseButtonPressed()) {
        this.panKeyPressed = true;
        event.accept();
      }

      return;
    }
  }

  /**
   * 处理空格键抬起并退出待平移状态。
   * @param event 键盘抬起事件。
   */
  override onKeyUp (event: InputEventKey): void {
    if (
      event.physicalKeycode.toLocaleLowerCase() === 'space'
      && this.panKeyPressed
    ) {
      this.panKeyPressed = false;
      event.accept();
    }
  }

  /**
   * 根据触发键开始视口平移。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    const button = event.buttonIndex;
    // 使用触发键判断，避免并发按键掩码影响中键平移。
    const shouldPan = button === MouseButton.Middle
      || ((this._owner.isHandToolMode() || this.panKeyPressed) && button === MouseButton.Left);

    if (!shouldPan) {
      if (this._owner.isHandToolMode() || this.isPanning()) {
        this._owner.setCursor(this.cursorResult);
        event.accept();
      }

      return;
    }
    this.beginPan(event);
    this._owner.setCursor(this.cursorResult);
    event.accept();
  }

  /**
   * 更新悬停阶段的视口平移。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    this.handlePointerMove(event);
  }

  /**
   * 更新拖拽阶段的视口平移。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    this.handlePointerMove(event);
  }

  /**
   * 结束视口平移。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    const handled = this.endPan();

    if (handled || this._owner.isHandToolMode() || this.isPanning()) {
      this._owner.setCursor(this.cursorResult);
      event.accept();
    }
  }

  /** 释放视口平移状态。 */
  override dispose (): void {
    this.endPan();
    super.dispose();
  }

  /**
   * 处理指针移动并更新光标。
   * @param event 鼠标移动事件。
   */
  private handlePointerMove (event: InputEventMouseMotion): void {
    const handled = this.pan(event);

    if (handled || this._owner.isHandToolMode() || this.isPanning()) {
      this._owner.setCursor(this.cursorResult);
      event.accept();
    }
  }

  /**
   * 进入视口平移会话。
   * @param event 鼠标按下事件。
   */
  private beginPan (event: InputEventMouseButton): void {
    this.dragType = DragType.PAN;
    this.lastPoint = new Vector2(event.position.x, event.position.y);
  }

  /**
   * 将鼠标位移应用到视口。
   * @param event 鼠标移动事件。
   * @returns 视口是否发生变化。
   */
  private pan (event: InputEventMouseMotion): boolean {
    if (this.dragType !== DragType.PAN) {
      return false;
    }
    const currentPoint = new Vector2(event.position.x, event.position.y);
    const shift = new Vector2().subtractVectors(currentPoint, this.lastPoint);
    const { shiftPressed } = event;

    shift.x = shiftPressed && shift.y !== 0
      ? Math.sqrt(shift.x ** 2 + shift.y ** 2) * shift.y / Math.abs(shift.y)
      : shift.x;
    shift.y = shiftPressed ? 0 : shift.y;
    const changed = this._owner.getViewportNavigation().panByViewDelta(
      shift,
      new Vector2(event.position.x, event.position.y),
      'hand-pan',
    );

    this.lastPoint.copyFrom(currentPoint);

    return changed;
  }

  /** @returns 结束前是否存在平移会话。 */
  private endPan (): boolean {
    const handled = this.dragType === DragType.PAN;

    this.dragType = DragType.NONE;

    return handled;
  }
}
