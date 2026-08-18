import { RectTransform } from '../rect-transform';
import type { ContainerControl, Control } from '../gui';
import type { Engine } from '../engine';
import { Component } from './component';
import { UICanvas } from './ui-canvas';

/**
 * Scene-tree bridge for a GUI Control. The VFXItem tree owns lifecycle and
 * serialization while the Control tree owns layout, drawing and input.
 */
export class UIControl extends Component {
  static fallbackParentGetDelegate?: (control: UIControl) => ContainerControl | null;

  private controlNode: Control | null = null;

  constructor (engine: Engine) {
    super(engine);
  }

  get control (): Control | null {
    return this.controlNode;
  }

  set control (value: Control | null) {
    if (value === this.controlNode) {
      return;
    }
    this.disposeControl();
    if (value) {
      if (value.owner && value.owner !== this && value.owner.control === value) {
        throw new Error('A Control can only be owned by one UIControl.');
      }
      this.controlNode = value;
      value.owner = this;
      this.syncControl();
    }
  }

  get hasControl (): boolean {
    return this.controlNode !== null;
  }

  override onAwake (): void {
    this.ensureRectTransform();
    this.syncControl();
  }

  override onEnable (): void {
    if (this.controlNode) {
      this.controlNode.visible = this.item.isActive;
      this.controlNode.enabled = true;
    }
  }

  override onDisable (): void {
    if (this.controlNode) {
      this.controlNode.visible = this.item.isActive;
      this.controlNode.enabled = false;
    }
  }

  override onParentChanged (): void {
    this.syncControl();
  }

  override onOrderInParentChanged (): void {
    this.syncControlOrder();
  }

  override onDestroy (): void {
    this.disposeControl();
  }

  override dispose (): void {
    this.disposeControl();
    super.dispose();
  }

  /** Unlinks the GUI object without disposing or modifying it. */
  unlinkControl (): void {
    if (this.controlNode) {
      this.controlNode = null;
    }
  }

  private disposeControl (): void {
    const control = this.controlNode;

    if (control) {
      this.controlNode = null;
      control.dispose();
    }
  }

  private syncControl (): void {
    const control = this.controlNode;

    if (!control || !this.item) {
      return;
    }
    this.ensureRectTransform();
    control.transform = this.item.transform as RectTransform;
    control.visible = this.item.isActive;
    control.enabled = this.enabled;
    control.parent = this.resolveParent();
    this.syncControlOrder();
  }

  private syncControlOrder (): void {
    if (this.controlNode && this.item) {
      this.controlNode.indexInParent = this.item.orderInParent;
    }
  }

  private resolveParent (): ContainerControl | null {
    const parentItem = this.item.parent;

    if (!parentItem) {
      return UIControl.fallbackParentGetDelegate?.(this) ?? null;
    }
    const uiControl = parentItem.getComponent(UIControl);

    if (uiControl?.control && 'children' in uiControl.control) {
      return uiControl.control as ContainerControl;
    }
    const canvas = parentItem.getComponent(UICanvas);

    return canvas?.rootControl ?? UIControl.fallbackParentGetDelegate?.(this) ?? null;
  }

  private ensureRectTransform (): void {
    if (this.item && !(this.item.transform instanceof RectTransform)) {
      this.item.transform = RectTransform.fromTransform(this.item.transform);
    }
    if (this.item?.transform instanceof RectTransform) {
      this.item.transform.setPivot(0, 0);
    }
  }
}
