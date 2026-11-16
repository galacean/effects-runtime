import { math } from '@galacean/effects';
import type { InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorIconControl } from '../icons/control-icons';
import { editorColors } from '../theme/control-theme';

/** Relative input keeps a captured drag independent of the hardware cursor position. */
export class EditorPointerLock {
  private requested = false;
  private active = false;
  private attempted = false;
  private disposed = false;
  private listening = false;
  private releaseRequested = true;
  private cursor?: EditorIconControl;
  private readonly cursorPosition = new math.Vector2();

  constructor (private readonly control: Control) { }

  get locked (): boolean { return this.active; }

  begin (event: InputEventMouseButton): void {
    this.attempted = false; this.releaseRequested = false;
    const root = this.control.root;

    if (root) { this.cursorPosition.copyFrom(root.makePositionLocal(event.globalPosition)); }
  }
  request (): void {
    if (this.attempted || this.requested || this.active || this.disposed || this.releaseRequested) { return; }
    this.attempted = true;
    const canvas = this.control.engine.canvas;

    if (!canvas.requestPointerLock || document.pointerLockElement) { return; }
    this.requested = true; this.connect();
    try { void Promise.resolve(canvas.requestPointerLock()).catch(this.failed); } catch { this.failed(); }
  }
  update (event: InputEventMouseMotion): void {
    if (this.active) {
      this.cursorPosition.add(event.screenRelative); this.positionCursor();
    } else {
      const root = this.control.root;

      if (root) { this.cursorPosition.copyFrom(root.makePositionLocal(event.globalPosition)); }
    }
  }
  finish (): void {
    this.releaseRequested = true;
    if (this.cursor) { this.cursor.parent = null; }
    if (this.active) { this.active = false; document.exitPointerLock(); }
    if (!this.requested) { this.disconnect(); }
  }
  private readonly changed = (): void => {
    if (this.requested && document.pointerLockElement === this.control.engine.canvas) {
      this.requested = false;
      if (!this.releaseRequested && !this.disposed) {
        this.active = true; this.showCursor();
      } else { document.exitPointerLock(); this.disconnect(); }
    } else if (this.active && document.pointerLockElement !== this.control.engine.canvas) {
      this.cancel();
    }
  };
  private readonly failed = (): void => { this.requested = false; if (!this.active) { this.disconnect(); } };
  private readonly cancel = (): void => {
    if (!this.releaseRequested) { this.control.root?.cancelPointerInput(); }
    this.finish();
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
  }
  private disconnect (): void {
    if (!this.listening) { return; }
    this.listening = false;
    document.removeEventListener('pointerlockchange', this.changed);
    document.removeEventListener('pointerlockerror', this.failed);
  }
}
