import type { Engine, InputEvent } from '@galacean/effects';
import { InputEventKey, InputEventMouseButton, InputEventMouseMotion, MouseButton, MouseButtonMask, math } from '@galacean/effects';
import { editorSurface } from '../../../platform/editor-surface';

/** The viewport forwards its captured Control events to the scene input server. */
export class SceneViewportInput {
  private buttons = MouseButtonMask.None;
  private position = new math.Vector2(-1, -1);
  private readonly keys = new Map<string, InputEventKey>();

  constructor (private readonly engine: Engine, private readonly onShortcut: (event: InputEventKey) => void) {
    window.addEventListener('keydown', this.textEscape);
    window.addEventListener('blur', this.reset);
  }

  mouse (event: InputEventMouseButton | InputEventMouseMotion): void {
    const forwarded = event.xformedBy(new math.Matrix3());

    forwarded.globalPosition.copyFrom(forwarded.position);
    this.position.copyFrom(event.position); this.buttons = event.buttonMask;
    this.emit(forwarded); event.accept();
    editorSurface.canvas.style.cursor = this.engine.canvas.style.cursor;
  }
  key (event: InputEventKey): void {
    const forwarded = Object.assign(new InputEventKey(), event);

    forwarded.clearAccepted();
    if (event.pressed) { this.keys.set(event.physicalKeycode, forwarded); this.onShortcut(forwarded); } else { this.keys.delete(event.physicalKeycode); }
    if (!forwarded.isAccepted()) { this.emit(forwarded); }
    if (forwarded.isAccepted()) { event.accept(); }
  }
  leave (): void {
    if (this.buttons !== MouseButtonMask.None) { return; }
    const event = new InputEventMouseMotion();

    event.position.set(-1, -1); event.globalPosition.set(-1, -1); this.emit(event);
    editorSurface.canvas.style.cursor = '';
  }
  finish (): void { this.resetInput(false); }
  readonly reset = (): void => { this.resetInput(true); };

  private resetInput (canceled: boolean): void {
    for (const [button, mask] of [[MouseButton.Left, MouseButtonMask.Left], [MouseButton.Right, MouseButtonMask.Right], [MouseButton.Middle, MouseButtonMask.Middle]] as const) {
      if (!(this.buttons & mask)) { continue; }
      this.buttons &= ~mask;
      const event = new InputEventMouseButton();

      event.buttonIndex = button; event.buttonMask = this.buttons; event.position.copyFrom(this.position);
      event.globalPosition.copyFrom(this.position); event.canceled = canceled; this.emit(event);
    }
    for (const key of this.keys.values()) { key.pressed = false; key.clearAccepted(); this.emit(key); }
    this.keys.clear(); this.leave(); this.engine.inputServer.emit('canvasBlur');
  }
  private readonly textEscape = (native: KeyboardEvent): void => {
    if (native.code !== 'Escape' || !(native.target instanceof HTMLTextAreaElement) || !this.engine.canvas.parentElement?.contains(native.target)) { return; }
    const event = new InputEventKey();

    event.pressed = true; event.keycode = event.physicalKeycode = 'Escape'; this.onShortcut(event);
    editorSurface.canvas.focus(); native.preventDefault();
  };
  dispose (): void {
    this.reset(); window.removeEventListener('keydown', this.textEscape); window.removeEventListener('blur', this.reset);
  }
  private emit (event: InputEvent): void { this.engine.inputServer.emit('input', event); }
}
