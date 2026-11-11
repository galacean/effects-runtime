import { MouseButton, math } from '@galacean/effects';
import type { InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { isDragThresholdReached } from '@galacean/effects-plugin-editor-gizmo';
import type { Control, RootControl } from '@galacean/effects-plugin-gui';

const buttons = new Set([
  MouseButton.Left, MouseButton.Right, MouseButton.Middle, MouseButton.Xbutton1, MouseButton.Xbutton2,
]);
const activeInteractions = new WeakMap<RootControl, EditorPointerInteraction>();

export function cancelEditorPointerInteraction (root: RootControl): void { activeInteractions.get(root)?.cancel(); }

/** Retains the input owner until the admitted pointer sequence ends. */
export class EditorPointerInteraction {
  moved = false;
  private button = MouseButton.None;
  private root?: RootControl;
  private readonly origin = new math.Vector2();

  constructor (private readonly owner: Control, private readonly canceled: () => void) { }

  get active (): boolean { return this.button !== MouseButton.None; }
  get buttonIndex (): MouseButton { return this.button; }

  begin (event: InputEventMouseButton): void {
    this.cancel();
    const root = this.owner.root;

    if (!root || !buttons.has(event.buttonIndex)) { return; }
    activeInteractions.get(root)?.cancel();
    this.root = root; this.button = event.buttonIndex; this.moved = false;
    this.origin.copyFrom(event.globalPosition); activeInteractions.set(root, this);
    root.on('guiFocusChanged', this.focusChanged);
    this.owner.on('parentChanged', this.validateOwner); this.owner.on('visibilityChanged', this.validateOwner); this.owner.on('enabledChanged', this.validateOwner);
  }

  move (event: InputEventMouseMotion): boolean {
    if (!this.active) { return false; }
    this.moved ||= isDragThresholdReached(this.origin.x, this.origin.y, event.globalPosition.x, event.globalPosition.y);

    return true;
  }

  end (event?: InputEventMouseButton): boolean {
    if (!this.active) { return false; }
    this.disconnect();
    if (event?.canceled) {
      this.canceled();

      return false;
    }

    return true;
  }

  readonly cancel = (): void => {
    if (!this.active) { return; }
    this.disconnect(); this.canceled();
  };

  private readonly validateOwner = (): void => {
    if (this.owner.isDisposed || this.owner.root !== this.root || !this.owner.visibleInHierarchy || !this.owner.enabledInHierarchy) { this.cancel(); }
  };

  private readonly focusChanged = (focused: Control | null): void => {
    for (let control = focused; control; control = control.parent) { if (control === this.owner) { return; } }
    this.cancel();
  };

  private disconnect (): void {
    if (this.root) {
      this.root.off('guiFocusChanged', this.focusChanged);
      if (activeInteractions.get(this.root) === this) { activeInteractions.delete(this.root); }
    }
    this.owner.off('parentChanged', this.validateOwner); this.owner.off('visibilityChanged', this.validateOwner); this.owner.off('enabledChanged', this.validateOwner);
    this.root = undefined; this.button = MouseButton.None;
  }
}
