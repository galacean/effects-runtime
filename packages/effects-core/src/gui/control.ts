import type { Color } from '@galacean/effects-math/es/core';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Engine } from '../engine';
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
import type { FontStyle, FontWeight, TextureRegion } from '../render';
import type { Texture } from '../texture';
import type { UIControl } from '../components/ui-control';
import type { VFXItem } from '../vfx-item';

/**
 * A drawable GUI object. Controls form a tree independent from the VFXItem
 * scene tree. UIControl is the bridge between both trees.
 */
export class Control {
  private _parent: ContainerControl | null = null;
  private _visible = true;
  private _enabled = true;
  private _mouseFilter = MouseFilter.Stop;
  private _mouseBehaviorRecursive = MouseBehaviorRecursive.Inherited;
  private _focusMode = FocusMode.None;
  private _focusBehaviorRecursive = FocusBehaviorRecursive.Inherited;
  private _defaultCursorShape = CursorShape.Arrow;
  private disposed = false;

  /** Scene-tree bridge that owns this GUI object, if any. */
  owner: UIControl | null = null;
  transform = new RectTransform();
  mouseForcePassScrollEvents = true;
  clipContents = false;

  constructor (readonly engine: Engine) {
    this.transform.engine = engine;
    this.transform.setPivot(0, 0);
  }

  get parent (): ContainerControl | null {
    return this._parent;
  }

  /** Scene item exposed through the optional UIControl bridge. */
  get item (): VFXItem | null {
    return this.owner?.item ?? null;
  }

  set parent (value: ContainerControl | null) {
    if (value === this._parent) {
      return;
    }
    const previousRoot = this.root;

    this._parent?.removeChildInternal(this);
    this._parent = value;
    value?.addChildInternal(this);
    this.transform.parentTransform = value?.transform ?? null;
    const nextRoot = this.root;

    if (previousRoot && previousRoot !== nextRoot) {
      previousRoot.controlRemoved(this);
    }
    nextRoot?.controlTreeChanged();
  }

  get indexInParent (): number {
    return this.parent?.getChildIndex(this) ?? -1;
  }

  set indexInParent (value: number) {
    this.parent?.changeChildIndex(this, value);
  }

  get visible (): boolean {
    return this._visible;
  }

  set visible (value: boolean) {
    if (this._visible !== value) {
      this._visible = value;
      this.root?.controlStateChanged(this);
    }
  }

  get visibleInHierarchy (): boolean {
    return this.visible && (this.parent?.visibleInHierarchy ?? true);
  }

  get enabled (): boolean {
    return this._enabled;
  }

  set enabled (value: boolean) {
    if (this._enabled !== value) {
      this._enabled = value;
      this.root?.controlStateChanged(this);
    }
  }

  get enabledInHierarchy (): boolean {
    return this.enabled && (this.parent?.enabledInHierarchy ?? true);
  }

  get mouseFilter (): MouseFilter {
    return this._mouseFilter;
  }

  set mouseFilter (value: MouseFilter) {
    if (this._mouseFilter !== value) {
      this._mouseFilter = value;
      this.root?.controlStateChanged(this);
    }
  }

  get mouseBehaviorRecursive (): MouseBehaviorRecursive {
    return this._mouseBehaviorRecursive;
  }

  set mouseBehaviorRecursive (value: MouseBehaviorRecursive) {
    if (this._mouseBehaviorRecursive !== value) {
      this._mouseBehaviorRecursive = value;
      this.root?.controlStateChanged(this);
    }
  }

  get focusMode (): FocusMode {
    return this._focusMode;
  }

  set focusMode (value: FocusMode) {
    if (this._focusMode !== value) {
      this._focusMode = value;
      this.root?.controlStateChanged(this);
    }
  }

  get focusBehaviorRecursive (): FocusBehaviorRecursive {
    return this._focusBehaviorRecursive;
  }

  set focusBehaviorRecursive (value: FocusBehaviorRecursive) {
    if (this._focusBehaviorRecursive !== value) {
      this._focusBehaviorRecursive = value;
      this.root?.controlStateChanged(this);
    }
  }

  get defaultCursorShape (): CursorShape {
    return this._defaultCursorShape;
  }

  set defaultCursorShape (value: CursorShape) {
    this._defaultCursorShape = value;
  }

  get root (): RootControl | null {
    return this instanceof RootControl ? this : this.parent?.root ?? null;
  }

  get isDisposed (): boolean {
    return this.disposed;
  }

  getGlobalTransform2D (): Matrix3 {
    const local = this.transform.getMatrix2D();

    return this.parent
      ? new Matrix3().multiplyMatrices(this.parent.getGlobalTransform2D(), local)
      : local.clone();
  }

  hasPoint (point: Vector2): boolean {
    const size = this.transform.size;

    return point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y;
  }

  getEffectiveMouseFilter (): MouseFilter {
    return this.enabledInHierarchy && this.isMouseRecursiveEnabled() ? this.mouseFilter : MouseFilter.Ignore;
  }

  getFocusModeWithOverride (): FocusMode {
    return this.enabledInHierarchy && this.isFocusRecursiveEnabled() ? this.focusMode : FocusMode.None;
  }

  getCursorShape (position: Vector2): CursorShape {
    return this.defaultCursorShape;
  }

  acceptEvent (): void {
    this.root?.acceptControlEvent(this);
  }

  focus (): void {
    this.root?.grabControlFocus(this);
  }

  grabFocus (): void {
    this.focus();
  }

  grabClickFocus (): void {
    this.root?.grabControlClickFocus(this);
  }

  releaseFocus (): void {
    this.root?.releaseControlFocus(this);
  }

  warpMouse (position: Vector2): void {
    const matrix = this.getGlobalTransform2D().elements;

    this.root?.warpControlMouse(new Vector2(
      matrix[0] * position.x + matrix[3] * position.y + matrix[6],
      matrix[1] * position.x + matrix[4] * position.y + matrix[7],
    ));
  }

  /** Converts a window-space position into this control's local coordinates. */
  makePositionLocal (position: Vector2): Vector2 {
    const transform = this.getGlobalTransform2D().clone();

    if (Math.abs(transform.determinant()) < 1e-12) {
      return new Vector2();
    }
    const elements = transform.invert().elements;

    return new Vector2(
      elements[0] * position.x + elements[3] * position.y + elements[6],
      elements[1] * position.x + elements[4] * position.y + elements[7],
    );
  }

  /** Gets the current mouse position transformed into this control's coordinates. */
  getLocalMousePosition (): Vector2 {
    const root = this.root;

    return root ? this.makePositionLocal(root.getMousePosition()) : new Vector2();
  }

  update (deltaTime: number): void {}

  draw (): void {
    // OVERRIDE
  }

  onDestroy (): void {}

  /** @internal */
  drawInternal (): void {
    if (!this.visibleInHierarchy || this.disposed) {
      return;
    }
    const graphics = this.engine.graphics;

    graphics.pushTransform(this.transform.getMatrix2D());
    this.draw();
    graphics.popTransform();
  }

  drawLine (x1: number, y1: number, x2: number, y2: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawLine(x1, y1, x2, y2, color, thickness);
  }

  drawPolyline (points: number[], color?: Color, thickness?: number): void {
    this.engine.graphics.drawLines(points, color, thickness);
  }

  drawBezier (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
    color?: Color, thickness?: number,
  ): void {
    this.engine.graphics.drawBezier(x1, y1, x2, y2, x3, y3, x4, y4, color, thickness);
  }

  drawTriangle (
    x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
    color?: Color, thickness?: number,
  ): void {
    this.engine.graphics.drawTriangle(x1, y1, x2, y2, x3, y3, color, thickness);
  }

  drawRect (x: number, y: number, width: number, height: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawRectangle(x, y, width, height, color, thickness);
  }

  drawCircle (cx: number, cy: number, radius: number, color?: Color, thickness?: number): void {
    this.engine.graphics.drawCircle(cx, cy, radius, color, thickness);
  }

  fillTriangle (
    x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color?: Color,
  ): void {
    this.engine.graphics.fillTriangle(x1, y1, x2, y2, x3, y3, color);
  }

  fillRect (x: number, y: number, width: number, height: number, color?: Color): void {
    this.engine.graphics.fillRectangle(x, y, width, height, color);
  }

  fillCircle (cx: number, cy: number, radius: number, color?: Color): void {
    this.engine.graphics.fillCircle(cx, cy, radius, color);
  }

  drawTexture (
    x: number, y: number, width: number, height: number,
    texture: Texture, region?: TextureRegion, color?: Color,
  ): void {
    this.engine.graphics.drawTexture(x, y, width, height, texture, region, color);
  }

  drawText (
    x: number, y: number, text: string, fontSize: number, color?: Color,
    fontFamily?: string, fontWeight?: FontWeight, fontStyle?: FontStyle,
  ): void {
    this.engine.graphics.drawText(x, y, text, fontSize, color, fontFamily, fontWeight, fontStyle);
  }

  onMouseEnter (location: Vector2): void {}
  onMouseMove (location: Vector2, event: InputEventMouseMotion): void {}
  onMouseLeave (): void {}
  onMouseWheel (location: Vector2, delta: number, event: InputEventMouseButton): void {}
  onMouseDown (location: Vector2, button: MouseButton, event: InputEventMouseButton): void {}
  onMouseUp (location: Vector2, button: MouseButton, event: InputEventMouseButton): void {}
  onTouchDown (location: Vector2, pointerId: number, event: InputEventScreenTouch): void {}
  onTouchMove (location: Vector2, pointerId: number, event: InputEventScreenDrag): void {}
  onTouchUp (location: Vector2, pointerId: number, event: InputEventScreenTouch): void {}
  onKeyDown (event: InputEventKey): void {}
  onKeyUp (event: InputEventKey): void {}
  onGotFocus (): void {}
  onLostFocus (): void {}

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

  protected getDragData (position: Vector2): unknown { return null; }
  protected canDropData (position: Vector2, data: unknown): boolean { return false; }
  protected dropData (position: Vector2, data: unknown): void {}

  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.onDestroy();
    this.parent = null;
    this.owner = null;
    this.transform.dispose();
  }

  private isMouseRecursiveEnabled (): boolean {
    if (this.mouseBehaviorRecursive === MouseBehaviorRecursive.Inherited) {
      return this.parent?.isMouseRecursiveEnabled() ?? true;
    }

    return this.mouseBehaviorRecursive === MouseBehaviorRecursive.Enabled;
  }

  private isFocusRecursiveEnabled (): boolean {
    if (this.focusBehaviorRecursive === FocusBehaviorRecursive.Inherited) {
      return this.parent?.isFocusRecursiveEnabled() ?? true;
    }

    return this.focusBehaviorRecursive === FocusBehaviorRecursive.Enabled;
  }
}

/** A Control that owns child Controls. */
export class ContainerControl extends Control {
  readonly children: Control[] = [];

  addChild<T extends Control> (child: T): T {
    child.parent = this;

    return child;
  }

  removeChild (child: Control): void {
    if (child.parent === this) {
      child.parent = null;
    }
  }

  getChildIndex (child: Control): number {
    return this.children.indexOf(child);
  }

  /** @internal */
  changeChildIndex (child: Control, newIndex: number): void {
    const oldIndex = this.children.indexOf(child);

    if (oldIndex === newIndex || oldIndex === -1) {
      return;
    }
    this.children.splice(oldIndex, 1);
    if (newIndex < 0 || newIndex >= this.children.length) {
      this.children.push(child);
    } else {
      this.children.splice(newIndex, 0, child);
    }
    this.root?.controlTreeChanged();
  }

  /** @internal */
  addChildInternal (child: Control): void {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
  }

  /** @internal */
  removeChildInternal (child: Control): void {
    const index = this.children.indexOf(child);

    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  drawSelf (): void {
    super.draw();
  }

  override draw (): void {
    this.drawSelf();
    this.drawChildren();
  }

  protected drawChildren (): void {
    const graphics = this.engine.graphics;

    if (this.clipContents) {
      // Graphics has no public rectangular clip stack yet. Keep the tree
      // boundary here so the renderer can add it without changing ownership.
    }
    for (const child of this.children) {
      if (!child.visible || child.isDisposed) {
        continue;
      }
      graphics.pushTransform(child.transform.getMatrix2D());
      child.draw();
      graphics.popTransform();
    }
  }

  override update (deltaTime: number): void {
    super.update(deltaTime);
    for (const child of this.children.slice()) {
      if (child.enabled && !child.isDisposed) {
        child.update(deltaTime);
      }
    }
  }

  override dispose (): void {
    for (const child of this.children.slice()) {
      child.dispose();
    }
    super.dispose();
  }
}

/** Base class for GUI tree roots and input dispatchers. */
export abstract class RootControl extends ContainerControl {
  abstract getMousePosition (): Vector2;
  abstract guiGetFocusOwner (): Control | null;
  abstract guiIsDragging (): boolean;
  abstract guiGetDragData (): unknown;
  abstract guiIsDragSuccessful (): boolean;
  abstract guiCancelDrag (): void;
  abstract acceptControlEvent (control: Control): void;
  abstract grabControlFocus (control: Control): void;
  abstract grabControlClickFocus (control: Control): void;
  abstract releaseControlFocus (control?: Control): void;
  abstract warpControlMouse (position: Vector2): void;
  abstract controlStateChanged (control: Control): void;
  abstract controlRemoved (control: Control): void;
  abstract controlTreeChanged (): void;
}
