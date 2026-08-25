import type { Control } from '../gui';
import { Container } from '../gui';
import type { Engine } from '../engine';
import type { Transform } from '../transform';
import { Component } from './component';
import { UICanvas } from './ui-canvas';

/**
 * Scene-tree bridge for a GUI Control. The VFXItem tree owns lifecycle and
 * serialization while the Control tree owns layout, drawing and input.
 */
export class UIControl extends Component {
  static fallbackParentGetDelegate?: (control: UIControl) => Control | null;

  private controlNode: Control | null = null;
  private linkedItemTransform: Transform | null = null;
  private linkedControl: Control | null = null;
  private syncingLocation = false;
  private readonly itemTransformChanged = () => this.syncItemLocationToControl();
  private readonly controlLocationChanged = () => this.syncControlLocationToItem();

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
      this.unbindLocationSync();
      this.controlNode = null;
    }
  }

  private disposeControl (): void {
    const control = this.controlNode;

    if (control) {
      this.unbindLocationSync();
      this.controlNode = null;
      control.dispose();
    }
  }

  private syncControl (): void {
    const control = this.controlNode;

    if (!control || !this.item) {
      return;
    }
    this.syncingLocation = true;
    try {
      control.visible = this.item.isActive;
      control.enabled = this.enabled;
      control.parent = this.resolveParent();
      this.syncControlOrder();
      this.copyItemLocationToControl();
    } finally {
      this.syncingLocation = false;
    }
    this.bindLocationSync();
  }

  private syncControlOrder (): void {
    if (this.controlNode && this.item) {
      this.controlNode.indexInParent = this.item.orderInParent;
    }
  }

  private resolveParent (): Control | null {
    const parentItem = this.item.parent;

    if (!parentItem) {
      return UIControl.fallbackParentGetDelegate?.(this) ?? null;
    }
    const uiControl = parentItem.getComponent(UIControl);

    if (uiControl?.control) {
      return uiControl.control;
    }
    const canvas = parentItem.getComponent(UICanvas);

    return canvas?.rootControl ?? UIControl.fallbackParentGetDelegate?.(this) ?? null;
  }

  private bindLocationSync (): void {
    const itemTransform = this.item.transform;
    const control = this.controlNode;

    if (this.linkedItemTransform === itemTransform && this.linkedControl === control) {
      return;
    }
    this.unbindLocationSync();
    if (control) {
      this.linkedItemTransform = itemTransform;
      this.linkedControl = control;
      itemTransform.on('changed', this.itemTransformChanged);
      control.on('locationChanged', this.controlLocationChanged);
    }
  }

  private unbindLocationSync (): void {
    this.linkedItemTransform?.off('changed', this.itemTransformChanged);
    this.linkedControl?.off('locationChanged', this.controlLocationChanged);
    this.linkedItemTransform = null;
    this.linkedControl = null;
  }

  private syncItemLocationToControl (): void {
    if (!this.syncingLocation && this.controlNode) {
      this.syncingLocation = true;
      try {
        this.copyItemLocationToControl();
      } finally {
        this.syncingLocation = false;
      }
    }
  }

  private syncControlLocationToItem (): void {
    const control = this.controlNode;

    if (!this.syncingLocation && control) {
      const source = control.location;
      const target = this.item.transform.position;

      if (source.x !== target.x || source.y !== target.y) {
        this.syncingLocation = true;
        try {
          this.item.transform.setPosition(source.x, source.y, target.z);
        } finally {
          this.syncingLocation = false;
        }
      }
    }
  }

  private copyItemLocationToControl (): void {
    const control = this.controlNode;

    // Automatic layout owns the local X/Y rectangle. Keep the reverse sync so
    // layout results still update the scene item transform.
    if (control && !(control.parent instanceof Container)) {
      const source = this.item.transform.position;
      const target = control.location;

      if (source.x !== target.x || source.y !== target.y) {
        control.setPosition(source.x, source.y);
      }
    }
  }
}
