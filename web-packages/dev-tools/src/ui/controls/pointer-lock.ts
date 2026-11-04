import { InputEventMouseMotion, MouseButtonMask, math } from '@galacean/effects';
import type { InputEventMouseButton } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorIconControl } from '../icons/control-icons';
import { editorColors } from '../theme/control-theme';
import { screenPosition } from './layout';

/** Relative input keeps a captured drag independent of the hardware cursor position. */
export class EditorPointerLock {
  readonly position = new math.Vector2();
  private requested = false;
  private active = false;
  private attempted = false;
  private disposed = false;
  private listening = false;
  private buttons = MouseButtonMask.None;
  private cursor?: EditorIconControl;
  private readonly cursorPosition = new math.Vector2();

  constructor (private readonly control: Control, private readonly move: (event: InputEventMouseMotion) => void) { }

  get locked (): boolean { return this.active; }

  begin (event: InputEventMouseButton): void {
    if (this.buttons === MouseButtonMask.None) { this.attempted = false; }
    this.buttons = event.buttonMask; this.position.copyFrom(event.position);
  }
  request (event: InputEventMouseMotion): void {
    if (!this.active) { this.position.copyFrom(event.position); }
    if (this.attempted || this.requested || this.active || this.disposed || !this.buttons) { return; }
    this.attempted = true;
    const canvas = this.control.engine.canvas;

    if (!canvas.requestPointerLock || document.pointerLockElement) { return; }
    this.requested = true; this.connect();
    try { void Promise.resolve(canvas.requestPointerLock()).catch(this.failed); } catch { this.failed(); }
  }
  release (event: InputEventMouseButton): void {
    if (this.active) {
      event.position.copyFrom(this.position);
      event.globalPosition.copyFrom(screenPosition(this.control, this.position.x, this.position.y));
    }
    this.buttons = event.buttonMask;
    if (this.buttons === MouseButtonMask.None) { this.finish(); }
  }
  finish (): void {
    this.buttons = MouseButtonMask.None;
    if (this.cursor) { this.cursor.parent = null; }
    if (this.active) { this.active = false; document.exitPointerLock(); }
    if (!this.requested) { this.disconnect(); }
  }
  private readonly changed = (): void => {
    if (this.requested && document.pointerLockElement === this.control.engine.canvas) {
      this.requested = false;
      if (this.buttons && !this.disposed) { this.active = true; this.showCursor(); } else { document.exitPointerLock(); this.disconnect(); }
    } else if (this.active && document.pointerLockElement !== this.control.engine.canvas) {
      this.cancel();
    }
  };
  private readonly failed = (): void => { this.requested = false; if (!this.active) { this.disconnect(); } };
  private readonly cancel = (): void => {
    if (this.buttons) { this.control.root?.cancelPointerInput(); }
    this.finish();
  };
  private readonly motion = (native: MouseEvent): void => {
    if (!this.active) { return; }
    this.position.x += native.movementX; this.position.y += native.movementY;
    this.cursorPosition.x += native.movementX; this.cursorPosition.y += native.movementY;
    this.positionCursor();
    const event = new InputEventMouseMotion();

    event.position.copyFrom(this.position);
    event.globalPosition.copyFrom(screenPosition(this.control, this.position.x, this.position.y));
    event.relative.set(native.movementX, native.movementY); event.screenRelative.copyFrom(event.relative);
    event.buttonMask = this.buttons; event.pressed = true;
    event.shiftPressed = native.shiftKey; event.altPressed = native.altKey; event.ctrlPressed = native.ctrlKey; event.metaPressed = native.metaKey;
    this.move(event); native.preventDefault(); native.stopPropagation();
  };
  dispose (): void {
    this.disposed = true; this.finish(); this.cursor?.dispose();
  }
  private showCursor (): void {
    const root = this.control.root;

    if (!root) { return; }
    this.cursor ??= new EditorIconControl(this.control.engine, 'numericScrub', 30);
    this.cursor.tint = editorColors.foregroundHover;
    this.cursor.setSize(this.cursor.iconSize, this.cursor.iconSize); this.cursor.parent = root;
    this.cursorPosition.copyFrom(root.makePositionLocal(screenPosition(this.control, this.position.x, this.position.y)));
    this.positionCursor();
  }
  private positionCursor (): void {
    const cursor = this.cursor, root = cursor?.parent;

    if (!cursor || !root || root.width <= 0 || root.height <= 0) { return; }
    this.cursorPosition.x = (this.cursorPosition.x % root.width + root.width) % root.width;
    this.cursorPosition.y = (this.cursorPosition.y % root.height + root.height) % root.height;
    cursor.setPosition(Math.round(this.cursorPosition.x - cursor.width / 2), Math.round(this.cursorPosition.y - cursor.height / 2));
  }
  private connect (): void {
    if (this.listening) { return; }
    this.listening = true;
    document.addEventListener('pointerlockchange', this.changed);
    document.addEventListener('pointerlockerror', this.failed);
    window.addEventListener('mousemove', this.motion, true);
    window.addEventListener('blur', this.cancel);
  }
  private disconnect (): void {
    if (!this.listening) { return; }
    this.listening = false;
    document.removeEventListener('pointerlockchange', this.changed);
    document.removeEventListener('pointerlockerror', this.failed);
    window.removeEventListener('mousemove', this.motion, true);
    window.removeEventListener('blur', this.cancel);
  }
}
