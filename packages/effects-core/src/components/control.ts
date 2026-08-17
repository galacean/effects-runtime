import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type {
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
} from '../input';
import {
  CursorShape,
  FocusBehaviorRecursive,
  FocusMode,
  MouseBehaviorRecursive,
  MouseFilter,
} from '../input';
import { RectTransform } from '../rect-transform';
import { CanvasItem } from './canvas-item';

export class Control extends CanvasItem {
  private _mouseFilter = MouseFilter.Stop;
  private _mouseBehaviorRecursive = MouseBehaviorRecursive.Inherited;
  private _mouseForcePassScrollEvents = true;
  private _clipContents = false;
  private _focusMode = FocusMode.None;
  private _focusBehaviorRecursive = FocusBehaviorRecursive.Inherited;
  private _defaultCursorShape = CursorShape.Arrow;

  get mouseFilter (): MouseFilter {
    return this._mouseFilter;
  }

  set mouseFilter (value: MouseFilter) {
    if (this._mouseFilter !== value) {
      this._mouseFilter = value;
      this.engine.viewport.controlStateChanged(this);
    }
  }

  get mouseBehaviorRecursive (): MouseBehaviorRecursive {
    return this._mouseBehaviorRecursive;
  }

  set mouseBehaviorRecursive (value: MouseBehaviorRecursive) {
    if (this._mouseBehaviorRecursive !== value) {
      this._mouseBehaviorRecursive = value;
      this.engine.viewport.controlStateChanged(this);
    }
  }

  get mouseForcePassScrollEvents (): boolean {
    return this._mouseForcePassScrollEvents;
  }

  set mouseForcePassScrollEvents (value: boolean) {
    this._mouseForcePassScrollEvents = value;
  }

  get clipContents (): boolean {
    return this._clipContents;
  }

  set clipContents (value: boolean) {
    if (this._clipContents !== value) {
      this._clipContents = value;
      this.engine.viewport.controlStateChanged(this);
    }
  }

  get focusMode (): FocusMode {
    return this._focusMode;
  }

  set focusMode (value: FocusMode) {
    if (this._focusMode !== value) {
      this._focusMode = value;
      this.engine.viewport.controlStateChanged(this);
    }
  }

  get focusBehaviorRecursive (): FocusBehaviorRecursive {
    return this._focusBehaviorRecursive;
  }

  set focusBehaviorRecursive (value: FocusBehaviorRecursive) {
    if (this._focusBehaviorRecursive !== value) {
      this._focusBehaviorRecursive = value;
      this.engine.viewport.controlStateChanged(this);
    }
  }

  get defaultCursorShape (): CursorShape {
    return this._defaultCursorShape;
  }

  set defaultCursorShape (value: CursorShape) {
    this._defaultCursorShape = value;
  }

  override onAwake (): void {
    const item = this.item;

    if (!(item.transform instanceof RectTransform)) {
      item.transform = RectTransform.fromTransform(item.transform);
    }
  }

  override onEnable (): void {
    super.onEnable();
    this.updateRootRegistration();
  }

  override onDisable (): void {
    super.onDisable();
    this.engine.viewport.controlStateChanged(this);
  }

  override onParentChanged (): void {
    super.onParentChanged();
    if (this.topLevel) {
      this.transform.parentTransform = null;
    }
    this.updateRootRegistration();
  }

  override onDestroy (): void {
    this.engine.viewport.controlRemoved(this);
    super.onDestroy();
  }

  acceptEvent (): void {
    this.engine.viewport.acceptEvent(this);
  }

  hasPoint (point: Vector2): boolean {
    const size = this.transform.size;

    return point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y;
  }

  getMouseFilterWithOverride (): MouseFilter {
    return this.isMouseRecursiveEnabled() ? this.mouseFilter : MouseFilter.Ignore;
  }

  getFocusModeWithOverride (): FocusMode {
    return this.isFocusRecursiveEnabled() ? this.focusMode : FocusMode.None;
  }

  getCursorShape (position: Vector2): CursorShape {
    return this.defaultCursorShape;
  }

  warpMouse (position: Vector2): void {
    const matrix = this.getGlobalTransform2D().elements;

    this.engine.viewport.warpMouse(new Vector2(
      matrix[0] * position.x + matrix[3] * position.y + matrix[6],
      matrix[1] * position.x + matrix[4] * position.y + matrix[7],
    ));
  }

  grabFocus (): void {
    this.engine.viewport.grabFocus(this);
  }

  grabClickFocus (): void {
    this.engine.viewport.grabClickFocus(this);
  }

  releaseFocus (): void {
    this.engine.viewport.releaseFocus(this);
  }

  onMouseEnter (location: Vector2): void {
    // OVERRIDE
  }

  onMouseMove (location: Vector2, event: InputEventMouseMotion): void {
    // OVERRIDE
  }

  onMouseLeave (): void {
    // OVERRIDE
  }

  onMouseWheel (location: Vector2, delta: number, event: InputEventMouseButton): void {
    // OVERRIDE
  }

  onMouseDown (location: Vector2, button: MouseButton, event: InputEventMouseButton): void {
    // OVERRIDE
  }

  onMouseUp (location: Vector2, button: MouseButton, event: InputEventMouseButton): void {
    // OVERRIDE
  }

  onTouchDown (location: Vector2, pointerId: number, event: InputEventScreenTouch): void {
    // OVERRIDE
  }

  onTouchMove (location: Vector2, pointerId: number, event: InputEventScreenDrag): void {
    // OVERRIDE
  }

  onTouchUp (location: Vector2, pointerId: number, event: InputEventScreenTouch): void {
    // OVERRIDE
  }

  onKeyDown (event: InputEventKey): void {
    // OVERRIDE
  }

  onKeyUp (event: InputEventKey): void {
    // OVERRIDE
  }

  onGotFocus (): void {
    // OVERRIDE
  }

  onLostFocus (): void {
    // OVERRIDE
  }

  /** @internal */
  getParentControl (): Control | null {
    const parentItem = this.item?.parent;

    if (!parentItem) {
      return null;
    }
    for (const component of parentItem.components) {
      if (component instanceof Control && !component.isCanvasItemDestroyed()) {
        return component;
      }
    }

    return null;
  }

  /** @internal */
  getParentControlInCanvas (): Control | null {
    let current = this.parent;

    while (current) {
      if (current instanceof Control) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  /** @internal */
  getEffectiveMouseFilter (): MouseFilter {
    return this.enabled ? this.getMouseFilterWithOverride() : MouseFilter.Ignore;
  }

  /** @internal */
  invokeGetDragData (position: Vector2): unknown {
    return this.getDragData(position);
  }

  /** @internal */
  invokeCanDropData (position: Vector2, data: unknown): boolean {
    return this.canDropData(position, data);
  }

  /** @internal */
  invokeDropData (position: Vector2, data: unknown): void {
    this.dropData(position, data);
  }

  protected getDragData (position: Vector2): unknown {
    return null;
  }

  protected canDropData (position: Vector2, data: unknown): boolean {
    return false;
  }

  protected dropData (position: Vector2, data: unknown): void {
    // OVERRIDE
  }

  protected override onCanvasTopologyChanged (): void {
    this.updateRootRegistration();
    this.engine.viewport.markRootsOrderDirty();
  }

  private updateRootRegistration (): void {
    if (!this.item || this.isCanvasItemDestroyed()) {
      this.engine.viewport.removeRootControl(this);

      return;
    }
    if (this.topLevel || !this.getParentControlInCanvas()) {
      this.engine.viewport.addRootControl(this);
    } else {
      this.engine.viewport.removeRootControl(this);
    }
  }

  private isMouseRecursiveEnabled (): boolean {
    if (this.mouseBehaviorRecursive === MouseBehaviorRecursive.Inherited) {
      return this.getParentControl()?.isMouseRecursiveEnabled() ?? true;
    }

    return this.mouseBehaviorRecursive === MouseBehaviorRecursive.Enabled;
  }

  private isFocusRecursiveEnabled (): boolean {
    if (this.focusBehaviorRecursive === FocusBehaviorRecursive.Inherited) {
      return this.getParentControl()?.isFocusRecursiveEnabled() ?? true;
    }

    return this.focusBehaviorRecursive === FocusBehaviorRecursive.Enabled;
  }
}
