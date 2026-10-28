import {
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  MouseButtonMask,
  math,
} from '@galacean/effects';
import type { Engine, InputEventMouse } from '@galacean/effects';
import { ImGui, ImGui_Impl } from '../../imgui';

const BUTTONS = [
  { button: MouseButton.Left, mask: MouseButtonMask.Left },
  { button: MouseButton.Right, mask: MouseButtonMask.Right },
  { button: MouseButton.Middle, mask: MouseButtonMask.Middle },
];

/** 将视口输入归一化后交给运行时，持续转发已捕获的拖拽与释放。 */
export class SceneViewportInput {
  private buttons = MouseButtonMask.None;
  private hovered = false;
  private focused = false;
  private position = new math.Vector2(-1, -1);
  private readonly keys = new Map<string, InputEventKey>();

  constructor (private readonly engine: Engine, private readonly onShortcut: (event: InputEventKey) => void) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
  }

  update (origin: ImGui.Vec2, hovered: boolean, focused: boolean): void {
    const io = ImGui.GetIO();
    const mouse = ImGui.GetMousePos();
    const captured = this.buttons !== MouseButtonMask.None;
    const position = hovered || captured
      ? new math.Vector2(mouse.x - origin.x, mouse.y - origin.y)
      : new math.Vector2(-1, -1);

    this.focused = focused && !io.WantTextInput && !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup);
    if (hovered || captured || this.hovered) {
      const event = this.mouseEvent(new InputEventMouseMotion(), position);

      event.relative.copyFrom(position).subtract(this.position);
      event.screenRelative.copyFrom(event.relative);
      event.pressed = captured;
      this.emit(event);
    }
    this.position.copyFrom(position);
    this.hovered = hovered;

    BUTTONS.forEach(({ button, mask }, index) => {
      if (hovered && ImGui.IsMouseClicked(index)) {
        this.buttons |= mask;
        const event = this.mouseEvent(new InputEventMouseButton(), position);

        event.buttonIndex = button;
        event.pressed = true;
        event.doubleClick = ImGui.IsMouseDoubleClicked(index);
        this.emit(event);
      }
      if ((this.buttons & mask) !== 0 && !ImGui.IsMouseDown(index)) {
        this.buttons &= ~mask;
        const event = this.mouseEvent(new InputEventMouseButton(), position);

        event.buttonIndex = button;
        this.emit(event);
      }
    });

    if (hovered) {
      this.wheel(io.MouseWheel, MouseButton.WheelUp, MouseButton.WheelDown);
      this.wheel(-io.MouseWheelH, MouseButton.WheelLeft, MouseButton.WheelRight);
    }
    const canvas = ImGui_Impl.getCanvas();

    if (canvas) {
      canvas.style.cursor = hovered || this.buttons !== MouseButtonMask.None ? this.engine.canvas.style.cursor : '';
    }
  }

  finish (): void { this.resetInput(false); }

  readonly reset = (): void => { this.resetInput(true); };

  private resetInput (canceled: boolean): void {
    for (const { button, mask } of BUTTONS) {
      if ((this.buttons & mask) !== 0) {
        this.buttons &= ~mask;
        const event = this.mouseEvent(new InputEventMouseButton(), this.position);

        event.buttonIndex = button;
        event.canceled = canceled;
        this.emit(event);
      }
    }
    for (const key of this.keys.values()) {
      key.pressed = false;
      key.clearAccepted();
      this.emit(key);
    }
    this.keys.clear();
    this.focused = false;
    if (this.hovered) {
      this.emit(this.mouseEvent(new InputEventMouseMotion(), new math.Vector2(-1, -1)));
    }
    this.hovered = false;
    this.engine.inputServer.emit('canvasBlur');
    const canvas = ImGui_Impl.getCanvas();

    if (canvas) {
      canvas.style.cursor = '';
    }
  }

  dispose (): void {
    this.reset();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
  }

  private mouseEvent<T extends InputEventMouse> (event: T, position: math.Vector2): T {
    const io = ImGui.GetIO();

    event.device = InputEvent.deviceIdMouse;
    event.position.copyFrom(position);
    event.globalPosition.copyFrom(position);
    event.buttonMask = this.buttons;
    event.shiftPressed = io.KeyShift;
    event.altPressed = io.KeyAlt;
    event.ctrlPressed = io.KeyCtrl;
    event.metaPressed = io.KeySuper;

    return event;
  }

  private wheel (delta: number, positive: MouseButton, negative: MouseButton): void {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    const event = this.mouseEvent(new InputEventMouseButton(), this.position);

    event.buttonIndex = delta > 0 ? positive : negative;
    event.factor = Math.abs(delta);
    event.pressed = true;
    this.emit(event);
  }

  private readonly onKeyDown = (native: KeyboardEvent): void => {
    const editingText = native.target instanceof HTMLTextAreaElement
      && this.engine.canvas.parentElement?.contains(native.target);

    if (editingText && native.code === 'Escape') {
      this.onShortcut(this.keyEvent(native, true));
      ImGui_Impl.getCanvas()?.focus();
      native.preventDefault();

      return;
    }
    if (!this.focused || native.target !== ImGui_Impl.getCanvas() || ImGui.GetIO().WantTextInput) {
      return;
    }
    const event = this.keyEvent(native, true);

    this.keys.set(native.code, event);
    this.onShortcut(event);
    if (!event.isAccepted()) {
      this.emit(event);
    }
    if (event.isAccepted()) {
      native.preventDefault();
    }
  };

  private readonly onKeyUp = (native: KeyboardEvent): void => {
    if (this.keys.delete(native.code)) {
      this.emit(this.keyEvent(native, false));
    }
  };

  private keyEvent (native: KeyboardEvent, pressed: boolean): InputEventKey {
    const event = new InputEventKey();

    event.device = InputEvent.deviceIdKeyboard;
    event.pressed = pressed;
    event.echo = native.repeat;
    event.keycode = native.key;
    event.physicalKeycode = native.code;
    event.keyLabel = native.key;
    event.shiftPressed = native.shiftKey;
    event.altPressed = native.altKey;
    event.ctrlPressed = native.ctrlKey;
    event.metaPressed = native.metaKey;

    return event;
  }

  private emit (event: InputEvent): void {
    this.engine.inputServer.emit('input', event);
  }
}
