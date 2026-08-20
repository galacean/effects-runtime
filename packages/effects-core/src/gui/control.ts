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
import type { EventEmitterListener, EventEmitterOptions } from '../events';
import { EventEmitter } from '../events';
import type { FontStyle, FontWeight, TextureRegion } from '../render';
import type { Texture } from '../texture';
import type { UIControl } from '../components/ui-control';
import type { VFXItem } from '../vfx-item';

export type Rect = {
  position: Vector2,
  size: Vector2,
};

export type LayoutPreset =
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  | 'centerLeft' | 'centerTop' | 'centerRight' | 'centerBottom'
  | 'center'
  | 'leftWide' | 'topWide' | 'rightWide' | 'bottomWide'
  | 'vcenterWide' | 'hcenterWide'
  | 'fullRect';

export type ControlEvent = {
  locationChanged: [control: Control],
  sizeChanged: [control: Control],
  parentChanged: [control: Control],
};

const ANCHOR_PRESET_TABLE: Record<LayoutPreset, [number, number, number, number]> = {
  topLeft: [0, 1, 0, 1],
  topRight: [1, 1, 1, 1],
  bottomLeft: [0, 0, 0, 0],
  bottomRight: [1, 0, 1, 0],
  centerLeft: [0, 0.5, 0, 0.5],
  centerTop: [0.5, 1, 0.5, 1],
  centerRight: [1, 0.5, 1, 0.5],
  centerBottom: [0.5, 0, 0.5, 0],
  center: [0.5, 0.5, 0.5, 0.5],
  leftWide: [0, 0, 0, 1],
  topWide: [0, 1, 1, 1],
  rightWide: [1, 0, 1, 1],
  bottomWide: [0, 0, 1, 0],
  vcenterWide: [0.5, 0, 0.5, 1],
  hcenterWide: [0, 0.5, 1, 0.5],
  fullRect: [0, 0, 1, 1],
};

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
  private _rotation = 0;
  private transformDirty = true;
  private readonly cachedTransform = new Matrix3();
  private readonly eventEmitter = new EventEmitter<ControlEvent>();
  private disposed = false;

  /** Scene-tree bridge that owns this GUI object, if any. */
  owner: UIControl | null = null;
  readonly position = new Vector2();
  readonly size = new Vector2(1, 1);
  readonly anchorMin = new Vector2();
  readonly anchorMax = new Vector2();
  readonly offsetMin = new Vector2();
  readonly offsetMax = new Vector2(1, 1);
  readonly pivot = new Vector2(0.5, 0.5);
  readonly scale = new Vector2(1, 1);
  readonly shear = new Vector2();
  mouseForcePassScrollEvents = true;
  clipContents = false;

  constructor (readonly engine: Engine) {}

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
    this.updateLayout();
    const nextRoot = this.root;

    if (previousRoot && previousRoot !== nextRoot) {
      previousRoot.controlRemoved(this);
    }
    nextRoot?.controlTreeChanged();
    this.eventEmitter.emit('parentChanged', this);
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

  get location (): Vector2 {
    return this.position;
  }

  set location (value: Vector2) {
    this.setPosition(value.x, value.y);
  }

  get rotation (): number {
    return this._rotation;
  }

  get x (): number {
    return this.position.x;
  }

  set x (value: number) {
    this.setPosition(value, this.position.y);
  }

  get y (): number {
    return this.position.y;
  }

  set y (value: number) {
    this.setPosition(this.position.x, value);
  }

  get width (): number {
    return this.size.x;
  }

  set width (value: number) {
    this.setSize(value, this.size.y);
  }

  get height (): number {
    return this.size.y;
  }

  set height (value: number) {
    this.setSize(this.size.x, value);
  }

  on<E extends keyof ControlEvent> (
    eventName: E,
    listener: EventEmitterListener<ControlEvent[E]>,
    options?: EventEmitterOptions,
  ): void {
    this.eventEmitter.on(eventName, listener, options);
  }

  off<E extends keyof ControlEvent> (
    eventName: E,
    listener: EventEmitterListener<ControlEvent[E]>,
  ): void {
    this.eventEmitter.off(eventName, listener);
  }

  setPosition (x: number, y: number, keepOffsets = false): void {
    if (this.position.x === x && this.position.y === y) {
      return;
    }
    const rect = { position: new Vector2(x, y), size: this.size.clone() };

    if (keepOffsets && this.parent) {
      this.computeAnchors(rect, this.getParentRect());
    } else {
      this.computeOffsets(rect, this.getParentRect());
    }
    this.updateLayout();
  }

  setSize (width: number, height: number): void {
    if (this.size.x === width && this.size.y === height) {
      return;
    }
    const rect = { position: this.position.clone(), size: new Vector2(width, height) };

    this.computeOffsets(rect, this.getParentRect());
    this.updateLayout();
  }

  setScale (x: number, y: number): void {
    if (this.scale.x !== x || this.scale.y !== y) {
      this.scale.set(x, y);
      this.markTransformDirty();
    }
  }

  setRotation (degrees: number): void {
    if (this._rotation !== degrees) {
      this._rotation = degrees;
      this.markTransformDirty();
    }
  }

  setShear (x: number, y: number): void {
    if (this.shear.x !== x || this.shear.y !== y) {
      this.shear.set(x, y);
      this.markTransformDirty();
    }
  }

  setPivot (x: number, y: number): void {
    if (this.pivot.x !== x || this.pivot.y !== y) {
      this.pivot.set(x, y);
      this.markTransformDirty();
    }
  }

  setAnchorMin (x: number, y: number): void {
    if (this.anchorMin.x !== x || this.anchorMin.y !== y) {
      this.anchorMin.set(x, y);
      this.updateLayout();
    }
  }

  setAnchorMax (x: number, y: number): void {
    if (this.anchorMax.x !== x || this.anchorMax.y !== y) {
      this.anchorMax.set(x, y);
      this.updateLayout();
    }
  }

  setOffsetMin (x: number, y: number): void {
    if (this.offsetMin.x !== x || this.offsetMin.y !== y) {
      this.offsetMin.set(x, y);
      this.updateLayout();
    }
  }

  setOffsetMax (x: number, y: number): void {
    if (this.offsetMax.x !== x || this.offsetMax.y !== y) {
      this.offsetMax.set(x, y);
      this.updateLayout();
    }
  }

  getRect (): Rect {
    return {
      position: this.position.clone(),
      size: this.size.clone(),
    };
  }

  getTransform2D (): Matrix3 {
    if (this.transformDirty) {
      const radians = this._rotation * Math.PI / 180;
      const sin = Math.sin(radians);
      const cos = Math.cos(radians);
      const shearX = Math.tan(Math.max(-89, Math.min(89, this.shear.x)) * Math.PI / 180);
      const shearY = Math.tan(Math.max(-89, Math.min(89, this.shear.y)) * Math.PI / 180);
      const a = this.scale.x * (cos - sin * shearY);
      const b = this.scale.x * (sin + cos * shearY);
      const c = this.scale.y * (cos * shearX - sin);
      const d = this.scale.y * (sin * shearX + cos);
      const pivotX = this.pivot.x * this.size.x;
      const pivotY = this.pivot.y * this.size.y;
      const tx = this.position.x + pivotX - a * pivotX - c * pivotY;
      const ty = this.position.y + pivotY - b * pivotX - d * pivotY;

      this.cachedTransform.set(a, b, 0, c, d, 0, tx, ty, 1);
      this.transformDirty = false;
    }

    return this.cachedTransform;
  }

  setAnchorsPreset (preset: LayoutPreset, keepOffsets = true): void {
    const [minX, minY, maxX, maxY] = ANCHOR_PRESET_TABLE[preset];

    if (keepOffsets) {
      this.anchorMin.set(minX, minY);
      this.anchorMax.set(maxX, maxY);
    } else {
      const rect = this.getRect();

      this.anchorMin.set(minX, minY);
      this.anchorMax.set(maxX, maxY);
      this.computeOffsets(rect, this.getParentRect());
    }
    this.updateLayout();
  }

  setOffsetsPreset (preset: LayoutPreset, margin = 0): void {
    if (!this.parent) {
      return;
    }
    const parentSize = this.parent.size;
    const width = this.size.x;
    const height = this.size.y;
    const a = this.anchorMin;
    const b = this.anchorMax;
    let minX = 0, maxX = 0, minY = 0, maxY = 0;

    switch (preset) {
      case 'topLeft': case 'bottomLeft': case 'centerLeft':
      case 'topWide': case 'bottomWide': case 'leftWide': case 'hcenterWide': case 'fullRect':
        minX = margin - a.x * parentSize.x;
        maxX = margin + width - b.x * parentSize.x;

        break;
      case 'centerTop': case 'centerBottom': case 'center': case 'vcenterWide':
        minX = 0.5 * parentSize.x - width / 2 - a.x * parentSize.x;
        maxX = 0.5 * parentSize.x + width / 2 - b.x * parentSize.x;

        break;
      default:
        minX = parentSize.x - margin - width - a.x * parentSize.x;
        maxX = parentSize.x - margin - b.x * parentSize.x;

        break;
    }
    switch (preset) {
      case 'bottomLeft': case 'bottomRight': case 'centerBottom':
      case 'leftWide': case 'rightWide': case 'bottomWide': case 'vcenterWide': case 'fullRect':
        minY = margin - a.y * parentSize.y;
        maxY = margin + height - b.y * parentSize.y;

        break;
      case 'centerLeft': case 'centerRight': case 'center': case 'hcenterWide':
        minY = 0.5 * parentSize.y - height / 2 - a.y * parentSize.y;
        maxY = 0.5 * parentSize.y + height / 2 - b.y * parentSize.y;

        break;
      default:
        minY = parentSize.y - margin - height - a.y * parentSize.y;
        maxY = parentSize.y - margin - b.y * parentSize.y;

        break;
    }
    this.offsetMin.set(minX, minY);
    this.offsetMax.set(maxX, maxY);
    this.updateLayout();
  }

  setAnchorsAndOffsetsPreset (preset: LayoutPreset, margin = 0): void {
    this.setAnchorsPreset(preset, false);
    this.setOffsetsPreset(preset, margin);
  }

  get root (): RootControl | null {
    return this instanceof RootControl ? this : this.parent?.root ?? null;
  }

  get isDisposed (): boolean {
    return this.disposed;
  }

  getGlobalTransform2D (): Matrix3 {
    const local = this.getTransform2D();

    return this.parent
      ? new Matrix3().multiplyMatrices(this.parent.getGlobalTransform2D(), local)
      : local.clone();
  }

  hasPoint (point: Vector2): boolean {
    return point.x >= 0 && point.y >= 0 && point.x <= this.size.x && point.y <= this.size.y;
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

    graphics.pushTransform(this.getTransform2D());
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
  }

  /** @internal */
  updateLayout (): void {
    const parentSize = this.parent?.size ?? new Vector2();
    const left = this.offsetMin.x + this.anchorMin.x * parentSize.x;
    const bottom = this.offsetMin.y + this.anchorMin.y * parentSize.y;
    const right = this.offsetMax.x + this.anchorMax.x * parentSize.x;
    const top = this.offsetMax.y + this.anchorMax.y * parentSize.y;

    this.applyBounds(left, bottom, right - left, top - bottom);
  }

  private applyBounds (x: number, y: number, width: number, height: number): void {
    const locationChanged = this.position.x !== x || this.position.y !== y;
    const sizeChanged = this.size.x !== width || this.size.y !== height;

    if (!locationChanged && !sizeChanged) {
      return;
    }
    this.position.set(x, y);
    this.size.set(width, height);
    this.markTransformDirty();
    if (locationChanged) {
      this.eventEmitter.emit('locationChanged', this);
    }
    if (sizeChanged) {
      this.eventEmitter.emit('sizeChanged', this);
      if (this instanceof ContainerControl) {
        for (const child of this.children.slice()) {
          child.updateLayout();
        }
      }
    }
  }

  private markTransformDirty (): void {
    this.transformDirty = true;
    this.root?.controlTreeChanged();
  }

  private getParentRect (): Rect {
    return {
      position: new Vector2(),
      size: this.parent?.size.clone() ?? new Vector2(),
    };
  }

  private computeOffsets (rect: Rect, parentRect: Rect): void {
    this.offsetMin.set(
      rect.position.x - parentRect.position.x - this.anchorMin.x * parentRect.size.x,
      rect.position.y - parentRect.position.y - this.anchorMin.y * parentRect.size.y,
    );
    this.offsetMax.set(
      rect.position.x + rect.size.x - parentRect.position.x - this.anchorMax.x * parentRect.size.x,
      rect.position.y + rect.size.y - parentRect.position.y - this.anchorMax.y * parentRect.size.y,
    );
  }

  private computeAnchors (rect: Rect, parentRect: Rect): void {
    if (parentRect.size.x !== 0) {
      this.anchorMin.x = (rect.position.x - parentRect.position.x - this.offsetMin.x) / parentRect.size.x;
      this.anchorMax.x = (rect.position.x + rect.size.x - parentRect.position.x - this.offsetMax.x) / parentRect.size.x;
    }
    if (parentRect.size.y !== 0) {
      this.anchorMin.y = (rect.position.y - parentRect.position.y - this.offsetMin.y) / parentRect.size.y;
      this.anchorMax.y = (rect.position.y + rect.size.y - parentRect.position.y - this.offsetMax.y) / parentRect.size.y;
    }
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
      graphics.pushTransform(child.getTransform2D());
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
