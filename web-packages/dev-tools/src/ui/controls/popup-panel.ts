import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, math } from '@galacean/effects';
import { Control, GUIServer, MouseFilter, PopupPanel } from '@galacean/effects-plugin-gui';
import { screenPosition } from './layout';

class PopupBackdrop extends Control {
  constructor (engine: Engine, private readonly popup: EditorPopupPanel) {
    super(engine); this.mouseFilter = MouseFilter.Stop;
  }
  override hasPoint (position: math.Vector2): boolean {
    if (!super.hasPoint(position)) { return false; }
    if (!this.popup.parentPopup) { return true; }
    const point = screenPosition(this, position.x, position.y);

    for (let parent: EditorPopupPanel | undefined = this.popup.parentPopup; parent; parent = parent.parentPopup) {
      if (parent.hasPoint(parent.makePositionLocal(point))) { return false; }
    }

    return true;
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left || event.buttonIndex === MouseButton.Right) {
      this.popup.dismissFromOutside();
    }
    event.accept();
  }
}

export class EditorPopupPanel extends PopupPanel {
  closeOnOutsideClick = true;
  private readonly backdrop: PopupBackdrop;
  constructor (engine: Engine) {
    super(engine);
    // Detached popups need the complete theme before their first measurement.
    this.theme = engine.getServer(GUIServer).windowRoot.theme;
    this.backdrop = new PopupBackdrop(engine, this);
  }
  get parentPopup (): EditorPopupPanel | undefined { return undefined; }
  dismissFromOutside (): void {
    if (this.closeOnOutsideClick) { this.hidePopup(); } else { this.grabFocus(); }
  }
  override onPopupOpened (): void {
    this.backdrop.parent = this.parent;
    this.parent?.changeChildIndex(this.backdrop, this.parent.children.indexOf(this));
    this.resizeBackdrop();
    super.onPopupOpened();
  }
  override onPopupClosed (): void {
    this.backdrop.parent = null;
    super.onPopupClosed();
  }
  private resizeBackdrop (): void {
    this.backdrop.setSize(this.root?.width ?? 0, this.root?.height ?? 0);
  }
  override update (dt: number): void { this.resizeBackdrop(); super.update(dt); }
  override onDestroy (): void {
    super.onDestroy(); this.backdrop.dispose();
  }
}
