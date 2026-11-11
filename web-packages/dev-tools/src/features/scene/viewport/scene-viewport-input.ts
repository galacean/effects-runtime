import type { Engine, InputEvent, InputEventMouse } from '@galacean/effects';
import { FocusEventType, InputEventFocus, InputEventKey, InputEventMouseBoundary, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math } from '@galacean/effects';
import { editorSurface } from '../../../platform/editor-surface';
import { EditorTextInput } from '../../../platform/editor-text-input';

/** The viewport forwards its captured Control events to the scene input server. */
export class SceneViewportInput {
  private initiatingButton = MouseButton.None;
  private lastMouseInput: InputEventMouse | null = null;
  private lastMouseTime = 0;
  private focused = false;
  private hadFocus = false;
  private readonly keys = new Map<string, InputEventKey>();
  private readonly textInput: EditorTextInput;

  constructor (
    private readonly engine: Engine,
    private readonly onShortcut: (event: InputEventKey) => void,
    private readonly onCursorChanged: (cursor: string) => void,
  ) {
    this.textInput = new EditorTextInput(target => !!engine.canvas.parentElement?.contains(target), event => { editorSurface.engine.inputServer.pushInput(event); });
    editorSurface.engine.inputServer.on('input', this.hostInput);
  }

  mouse (event: InputEventMouseButton | InputEventMouseMotion): void {
    const forwarded = event.xformedBy(new math.Matrix3());

    forwarded.globalPosition.copyFrom(forwarded.position);
    if (forwarded instanceof InputEventMouseButton &&
      (forwarded.buttonIndex < MouseButton.WheelUp || forwarded.buttonIndex > MouseButton.WheelRight)) {
      if (!forwarded.isPressed() && this.initiatingButton === MouseButton.None) {
        const motion = new InputEventMouseMotion();

        this.copyMouseContext(motion, forwarded.position, forwarded);
        motion.buttonIndex = forwarded.buttonIndex;
        this.forwardMouse(motion); event.accept();

        return;
      }
      this.initiatingButton = forwarded.isPressed() ? forwarded.buttonIndex : MouseButton.None;
    }
    if (this.initiatingButton === MouseButton.None) { forwarded.buttonMask = MouseButtonMask.None; }
    if (forwarded instanceof InputEventMouseMotion) { forwarded.pressed = forwarded.buttonMask !== MouseButtonMask.None; }
    this.forwardMouse(forwarded); event.accept();
  }
  key (event: InputEventKey): void {
    const forwarded = Object.assign(new InputEventKey(), event);

    forwarded.clearAccepted();
    if (event.pressed) { this.onShortcut(forwarded); }
    if (!forwarded.isAccepted()) {
      if (forwarded.isPressed()) { this.keys.set(forwarded.physicalKeycode, forwarded); } else { this.keys.delete(forwarded.physicalKeycode); }
      this.emit(forwarded);
    }
    if (forwarded.isAccepted()) { event.accept(); }
  }
  enter (position: math.Vector2): void {
    this.boundary(position, true);
  }
  leave (position: math.Vector2): void {
    this.boundary(position, false);
    if (this.initiatingButton === MouseButton.None) { this.onCursorChanged('default'); }
  }
  focus (focused: boolean): void {
    if (this.focused === focused) { return; }
    this.focused = focused; this.hadFocus ||= focused;
    if (!focused) { this.endPointer(true); this.releaseKeys(); }
    this.emit(new InputEventFocus(focused ? FocusEventType.FocusGained : FocusEventType.FocusLost));
  }
  finish (): void { this.endPointer(false); }
  readonly reset = (): void => { this.endPointer(true); };

  private endPointer (canceled: boolean): void {
    if (this.initiatingButton === MouseButton.None || !this.lastMouseInput) { return; }
    const event = new InputEventMouseButton();

    this.copyMouseContext(event, this.lastMouseInput.position);
    event.buttonIndex = this.initiatingButton; event.canceled = canceled;
    this.initiatingButton = MouseButton.None;
    this.forwardMouse(event);
  }

  private boundary (position: math.Vector2, entered: boolean): void {
    if (entered || this.initiatingButton !== MouseButton.None) {
      const event = new InputEventMouseMotion();

      this.copyMouseContext(event, position);
      event.buttonMask = this.initiatingButton !== MouseButton.None ? this.lastMouseInput!.buttonMask : MouseButtonMask.None;
      event.pressed = event.buttonMask !== MouseButtonMask.None;
      if (this.lastMouseInput) {
        event.relative.copyFrom(position).subtract(this.lastMouseInput.position);
        event.screenRelative.copyFrom(event.relative);
        const elapsed = Math.max(performance.now() - this.lastMouseTime, 1);

        event.velocity.copyFrom(event.relative).scale(1 / elapsed);
        event.screenVelocity.copyFrom(event.velocity);
      }
      this.forwardMouse(event);
    } else {
      const event = new InputEventMouseBoundary(false);

      this.copyMouseContext(event, position); this.forwardMouse(event);
    }
  }

  private copyMouseContext (event: InputEventMouse, position: math.Vector2, previous = this.lastMouseInput): void {
    event.position.copyFrom(position); event.globalPosition.copyFrom(position);

    if (!previous) { return; }
    event.device = previous.device;
    event.shiftPressed = previous.shiftPressed; event.altPressed = previous.altPressed;
    event.ctrlPressed = previous.ctrlPressed; event.metaPressed = previous.metaPressed;
    event.commandOrControlAutoremap = previous.commandOrControlAutoremap;
  }

  private forwardMouse (event: InputEventMouse): void {
    this.lastMouseInput = event; this.lastMouseTime = performance.now(); this.emit(event);
  }

  private releaseKeys (): void {
    const keys = Array.from(this.keys.values());

    this.keys.clear();
    for (const key of keys) {
      const event = Object.assign(new InputEventKey(), key);

      event.pressed = false; event.echo = false; this.emit(event);
    }
  }

  private readonly hostInput = (event: InputEvent): void => {
    if (this.hadFocus && event instanceof InputEventFocus &&
      (event.type === FocusEventType.WindowFocusGained || event.type === FocusEventType.WindowFocusLost)) {
      if (event.type === FocusEventType.WindowFocusLost) { this.endPointer(true); this.releaseKeys(); }
      this.emit(new InputEventFocus(event.type));
    }
  };
  dispose (): void {
    this.reset(); this.releaseKeys(); this.textInput.dispose();
    editorSurface.engine.inputServer.off('input', this.hostInput);
  }
  private emit (event: InputEvent): void {
    this.engine.inputServer.pushInput(event);
    this.onCursorChanged(this.engine.canvas.style.cursor || 'default');
  }
}
