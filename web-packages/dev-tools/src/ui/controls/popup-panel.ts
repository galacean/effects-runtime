import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, math } from '@galacean/effects';
import { CanvasRootControl, Control, GUIServer, MouseFilter, PopupPanel } from '@galacean/effects-plugin-gui';
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
  modal = true;
  private readonly backdrop: PopupBackdrop;
  private modeless = false;
  private restoreFocus?: Control;
  constructor (engine: Engine) {
    super(engine);
    // Detached popups need the complete theme before their first measurement.
    this.theme = engine.getServer(GUIServer).windowRoot.theme;
    this.backdrop = new PopupBackdrop(engine, this);
  }
  get parentPopup (): EditorPopupPanel | undefined { return undefined; }
  override popup (position: math.Vector2, source: Control | null = null): void {
    if (this.modal) {
      const root = source?.root ?? this.root;
      const restore = source ?? root?.guiGetFocusOwner() ?? null;

      // A modal popup takes pointer ownership from the control that opened it.
      root?.cancelPointerInput();
      super.popup(position, restore);

      return;
    }
    this.hidePopup();
    const root = this.engine.getServer(GUIServer).windowRoot;
    let canvas: Control | null = source;

    while (canvas && !(canvas instanceof CanvasRootControl)) { canvas = canvas.parent; }
    canvas ??= root.canvases.children.find(child => child instanceof CanvasRootControl) ?? null;
    if (!canvas) { return; }
    this.restoreFocus = source ?? undefined;
    this.modeless = true; this.parent = canvas;
    const size = this.getBoundDesiredSize();

    this.setSize(Math.max(this.width, size.x), Math.max(this.height, size.y));
    this.setPosition(Math.max(0, Math.min(position.x, root.width - this.width)), Math.max(0, Math.min(position.y, root.height - this.height)));
    this.visible = true; root.on('guiFocusChanged', this.raiseIfFocused);
    this.onPopupOpened(); this.grabFocus();
  }
  override hidePopup (): void {
    if (!this.modeless) {
      super.hidePopup();

      return;
    }
    const root = this.root, restore = this.restoreFocus;
    let hadFocus = false;

    for (let control = root?.guiGetFocusOwner(); control; control = control.parent) {
      if (control === this) {
        hadFocus = true;

        break;
      }
    }
    root?.off('guiFocusChanged', this.raiseIfFocused);
    this.modeless = false; this.restoreFocus = undefined; this.visible = false; this.parent = null;
    this.onPopupClosed();
    if (hadFocus && restore && !restore.isDisposed && restore.visibleInHierarchy) { restore.grabFocus(); }
  }
  private readonly raiseIfFocused = (focused: Control | null): void => {
    for (let control = focused; control; control = control.parent) {
      if (control === this) {
        this.parent?.changeChildIndex(this, this.parent.children.length - 1);

        break;
      }
    }
  };
  dismissFromOutside (): void {
    if (this.closeOnOutsideClick) { this.hidePopup(); } else { this.grabFocus(); }
  }
  override onPopupOpened (): void {
    if (!this.modeless) {
      this.backdrop.parent = this.parent;
      this.parent?.changeChildIndex(this.backdrop, this.parent.children.indexOf(this));
      this.resizeBackdrop();
    }
    super.onPopupOpened();
  }
  override onPopupClosed (): void {
    this.backdrop.parent = null;
    super.onPopupClosed();
  }
  private resizeBackdrop (): void {
    this.backdrop.setSize(this.root?.width ?? 0, this.root?.height ?? 0);
  }
  override update (dt: number): void { if (!this.modeless) { this.resizeBackdrop(); } super.update(dt); }
  override onDestroy (): void {
    if (this.modeless) { this.hidePopup(); }
    super.onDestroy(); this.backdrop.dispose();
  }
}
