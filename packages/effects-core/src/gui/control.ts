import type { Color } from '@galacean/effects-math/es/core';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Engine } from '../engine';
import type {
  CursorStyle,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
} from '../input';
import {
  CursorShape,
  FocusBehaviorRecursive,
  FocusMode,
  MouseBehaviorRecursive,
  MouseFilter,
} from '../input';
import type { EventEmitterListener } from '../events';
import { EventEmitter } from '../events';
import type { FontStyle, FontWeight, TextMeasurement, TextureRegion } from '../render';
import type { Texture } from '../texture';
import type { UIControl } from '../components/ui-control';
import type { VFXItem } from '../vfx-item';
import { effectsClass } from '../decorators';
import type { ControlData } from './data';

export type Rect = {
  position: Vector2,
  size: Vector2,
};

/** Bit flags that describe how a Control uses space assigned by a Container. */
export enum SizeFlags {
  ShrinkBegin = 0,
  Fill = 1,
  Expand = 2,
  ShrinkCenter = 4,
  ShrinkEnd = 8,
  ExpandFill = Fill | Expand,
}

/** Direction in which a Control grows when a minimum size makes its requested rectangle larger. */
export enum GrowDirection {
  Begin,
  End,
  Both,
}

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
  minimumSizeChanged: [control: Control],
  desiredSizeChanged: [control: Control],
  maximumSizeChanged: [control: Control],
  sizeFlagsChanged: [control: Control],
  visibilityChanged: [control: Control],
  enabledChanged: [control: Control],
};

export type RootControlEvent = ControlEvent & {
  guiFocusChanged: [control: Control | null],
};

function normalizeMeasuredMinimum (value: Vector2): Vector2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new RangeError('Control minimum and desired sizes must be finite.');
  }

  return new Vector2(Math.max(0, value.x), Math.max(0, value.y));
}

function normalizeMeasuredMaximum (value: Vector2): Vector2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new RangeError('Control maximum sizes must be finite.');
  }

  return new Vector2(value.x < 0 ? -1 : value.x, value.y < 0 ? -1 : value.y);
}

function combineMaximum (measured: number, custom: number): number {
  if (measured < 0) {
    return custom;
  }
  if (custom < 0) {
    return measured;
  }

  return Math.min(measured, custom);
}

function clampToMaximum (value: number, maximum: number): number {
  return maximum < 0 ? value : Math.min(value, maximum);
}

const ANCHOR_PRESET_TABLE: Record<LayoutPreset, [number, number, number, number]> = {
  topLeft: [0, 0, 0, 0],
  topRight: [1, 0, 1, 0],
  bottomLeft: [0, 1, 0, 1],
  bottomRight: [1, 1, 1, 1],
  centerLeft: [0, 0.5, 0, 0.5],
  centerTop: [0.5, 0, 0.5, 0],
  centerRight: [1, 0.5, 1, 0.5],
  centerBottom: [0.5, 1, 0.5, 1],
  center: [0.5, 0.5, 0.5, 0.5],
  leftWide: [0, 0, 0, 1],
  topWide: [0, 0, 1, 0],
  rightWide: [1, 0, 1, 1],
  bottomWide: [0, 1, 1, 1],
  vcenterWide: [0.5, 0, 0.5, 1],
  hcenterWide: [0, 0.5, 1, 0.5],
  fullRect: [0, 0, 1, 1],
};

/**
 * A drawable GUI object. Controls form a tree independent from the VFXItem
 * scene tree. UIControl is the bridge between both trees.
 */
@effectsClass('Control')
export class Control {
  readonly engine: Engine;
  /** Scene-tree bridge that owns this GUI object, if any. */
  owner: UIControl | null = null;
  readonly children: Control[] = [];
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

  private _parent: Control | null = null;
  private _visible = true;
  private _enabled = true;
  private _mouseFilter = MouseFilter.Stop;
  private _mouseBehaviorRecursive = MouseBehaviorRecursive.Inherited;
  private _focusMode = FocusMode.None;
  private _focusBehaviorRecursive = FocusBehaviorRecursive.Inherited;
  private _defaultCursorShape: CursorStyle = CursorShape.Arrow;
  private _rotation = 0;
  private transformDirty = true;
  private readonly cachedTransform = new Matrix3();
  private readonly eventEmitter = new EventEmitter<ControlEvent>();
  private disposed = false;
  private readonly customMinimumSize = new Vector2();
  private readonly customMaximumSize = new Vector2(-1, -1);
  private minimumSizeCache: Vector2 | null = null;
  private desiredSizeCache: Vector2 | null = null;
  private maximumSizeCache: Vector2 | null = null;
  private _horizontalSizeFlags = SizeFlags.Fill;
  private _verticalSizeFlags = SizeFlags.Fill;
  private _stretchRatio = 1;
  private _horizontalGrowDirection = GrowDirection.End;
  private _verticalGrowDirection = GrowDirection.End;

  constructor (engine: Engine) {
    this.engine = engine;
  }

  get parent (): Control | null {
    return this._parent;
  }

  set parent (value: Control | null) {
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
    if (nextRoot && previousRoot !== nextRoot) {
      this.queuePendingLayouts();
    }
    if (previousRoot !== nextRoot) {
      this.notifyRootChanged(previousRoot, nextRoot);
    }
    nextRoot?.controlTreeChanged();
    this.eventEmitter.emit('parentChanged', this);
  }

  /** Scene item exposed through the optional UIControl bridge. */
  get item (): VFXItem | null {
    return this.owner?.item ?? null;
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
      this.eventEmitter.emit('visibilityChanged', this);
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
      this.eventEmitter.emit('enabledChanged', this);
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

  get defaultCursorShape (): CursorStyle {
    return this._defaultCursorShape;
  }

  set defaultCursorShape (value: CursorStyle) {
    if (this._defaultCursorShape === value) {
      return;
    }
    this._defaultCursorShape = value;
    this.root?.updateMouseCursorState();
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

  get horizontalSizeFlags (): SizeFlags {
    return this._horizontalSizeFlags;
  }

  set horizontalSizeFlags (value: SizeFlags) {
    this.setSizeFlags(value, this._verticalSizeFlags);
  }

  get verticalSizeFlags (): SizeFlags {
    return this._verticalSizeFlags;
  }

  set verticalSizeFlags (value: SizeFlags) {
    this.setSizeFlags(this._horizontalSizeFlags, value);
  }

  get stretchRatio (): number {
    return this._stretchRatio;
  }

  set stretchRatio (value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError('Control stretchRatio must be a finite number greater than zero.');
    }
    if (this._stretchRatio !== value) {
      this._stretchRatio = value;
      this.eventEmitter.emit('sizeFlagsChanged', this);
    }
  }

  get horizontalGrowDirection (): GrowDirection {
    return this._horizontalGrowDirection;
  }

  set horizontalGrowDirection (value: GrowDirection) {
    this.assertGrowDirection(value);
    if (this._horizontalGrowDirection !== value) {
      this._horizontalGrowDirection = value;
      this.updateLayout();
    }
  }

  get verticalGrowDirection (): GrowDirection {
    return this._verticalGrowDirection;
  }

  set verticalGrowDirection (value: GrowDirection) {
    this.assertGrowDirection(value);
    if (this._verticalGrowDirection !== value) {
      this._verticalGrowDirection = value;
      this.updateLayout();
    }
  }

  get root (): RootControl | null {
    return this instanceof RootControl ? this : this.parent?.root ?? null;
  }

  get isDisposed (): boolean {
    return this.disposed;
  }

  on<E extends keyof ControlEvent> (
    eventName: E,
    listener: EventEmitterListener<ControlEvent[E]>,
  ): void {
    this.eventEmitter.on(eventName, listener);
  }

  off<E extends keyof ControlEvent> (
    eventName: E,
    listener: EventEmitterListener<ControlEvent[E]>,
  ): void {
    this.eventEmitter.off(eventName, listener);
  }

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

  /** Atomically replaces the local rectangle while preserving the current anchors. */
  setRect (rect: Rect): void {
    const nextRect = {
      position: rect.position.clone(),
      size: rect.size.clone(),
    };

    this.computeOffsets(nextRect, this.getParentRect());
    this.updateLayout();
  }

  setSizeFlags (horizontal: SizeFlags, vertical: SizeFlags): void {
    if (!Number.isInteger(horizontal) || horizontal < SizeFlags.ShrinkBegin
      || !Number.isInteger(vertical) || vertical < SizeFlags.ShrinkBegin) {
      throw new RangeError('Control size flags must be non-negative integers.');
    }
    if (this._horizontalSizeFlags !== horizontal || this._verticalSizeFlags !== vertical) {
      this._horizontalSizeFlags = horizontal;
      this._verticalSizeFlags = vertical;
      this.eventEmitter.emit('sizeFlagsChanged', this);
    }
  }

  /** Intrinsic minimum size supplied by a subclass. */
  getMinimumSize (): Vector2 {
    return new Vector2();
  }

  /** Intrinsic preferred size supplied by a subclass. */
  getDesiredSize (): Vector2 {
    return new Vector2();
  }

  /** Intrinsic maximum size supplied by a subclass. Negative components are unbounded. */
  getMaximumSize (): Vector2 {
    return new Vector2(-1, -1);
  }

  getCombinedMinimumSize (): Vector2 {
    const measured = this.getCachedMinimumSize();

    return new Vector2(
      Math.max(measured.x, this.customMinimumSize.x),
      Math.max(measured.y, this.customMinimumSize.y),
    );
  }

  getCombinedMaximumSize (): Vector2 {
    const measured = this.getCachedMaximumSize();

    return new Vector2(
      combineMaximum(measured.x, this.customMaximumSize.x),
      combineMaximum(measured.y, this.customMaximumSize.y),
    );
  }

  /** Minimum size after resolving a conflicting maximum; the maximum wins. */
  getBoundMinimumSize (): Vector2 {
    const minimum = this.getCombinedMinimumSize();
    const maximum = this.getCombinedMaximumSize();

    return new Vector2(
      clampToMaximum(minimum.x, maximum.x),
      clampToMaximum(minimum.y, maximum.y),
    );
  }

  /** Desired size clamped to the resolved minimum and maximum constraints. */
  getBoundDesiredSize (): Vector2 {
    const minimum = this.getBoundMinimumSize();
    const maximum = this.getCombinedMaximumSize();
    const desired = this.getCachedDesiredSize();

    return new Vector2(
      Math.max(minimum.x, clampToMaximum(desired.x, maximum.x)),
      Math.max(minimum.y, clampToMaximum(desired.y, maximum.y)),
    );
  }

  setCustomMinimumSize (width: number, height: number): void {
    const next = normalizeMeasuredMinimum(new Vector2(width, height));

    if (this.customMinimumSize.x !== next.x || this.customMinimumSize.y !== next.y) {
      this.customMinimumSize.copyFrom(next);
      this.updateMinimumSize();
    }
  }

  setCustomMaximumSize (width: number, height: number): void {
    const next = normalizeMeasuredMaximum(new Vector2(width, height));

    if (this.customMaximumSize.x !== next.x || this.customMaximumSize.y !== next.y) {
      this.customMaximumSize.copyFrom(next);
      this.updateMaximumSize();
    }
  }

  updateMinimumSize (): void {
    this.minimumSizeCache = null;
    this.updateLayout();
    this.eventEmitter.emit('minimumSizeChanged', this);
  }

  updateDesiredSize (): void {
    this.desiredSizeCache = null;
    this.eventEmitter.emit('desiredSizeChanged', this);
  }

  updateMaximumSize (): void {
    this.maximumSizeCache = null;
    this.updateLayout();
    this.eventEmitter.emit('maximumSizeChanged', this);
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

    // Left edge.
    switch (preset) {
      case 'topLeft': case 'bottomLeft': case 'centerLeft':
      case 'topWide': case 'bottomWide': case 'leftWide': case 'hcenterWide': case 'fullRect':
        minX = margin - a.x * parentSize.x;

        break;
      case 'centerTop': case 'centerBottom': case 'center': case 'vcenterWide':
        minX = 0.5 * parentSize.x - width / 2 - a.x * parentSize.x;

        break;
      default:
        minX = parentSize.x - margin - width - a.x * parentSize.x;

        break;
    }
    switch (preset) {
      case 'topLeft': case 'bottomLeft': case 'centerLeft': case 'leftWide':
        maxX = margin + width - b.x * parentSize.x;

        break;
      case 'centerTop': case 'centerBottom': case 'center': case 'vcenterWide':
        maxX = 0.5 * parentSize.x + width / 2 - b.x * parentSize.x;

        break;
      default:
        maxX = parentSize.x - margin - b.x * parentSize.x;

        break;
    }
    // Top edge.
    switch (preset) {
      case 'topLeft': case 'topRight': case 'centerTop':
      case 'leftWide': case 'rightWide': case 'topWide': case 'vcenterWide': case 'fullRect':
        minY = margin - a.y * parentSize.y;

        break;
      case 'centerLeft': case 'centerRight': case 'center': case 'hcenterWide':
        minY = 0.5 * parentSize.y - height / 2 - a.y * parentSize.y;

        break;
      default:
        minY = parentSize.y - margin - height - a.y * parentSize.y;

        break;
    }
    // Bottom edge.
    switch (preset) {
      case 'topLeft': case 'topRight': case 'centerTop': case 'topWide':
        maxY = margin + height - b.y * parentSize.y;

        break;
      case 'centerLeft': case 'centerRight': case 'center': case 'hcenterWide':
        maxY = 0.5 * parentSize.y + height / 2 - b.y * parentSize.y;

        break;
      default:
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

  getGlobalTransform2D (): Matrix3 {
    const local = this.getTransform2D();

    return this.parent
      ? new Matrix3().multiplyMatrices(this.parent.getGlobalTransform2D(), local)
      : local.clone();
  }

  hasPoint (point: Vector2): boolean {
    return point.x >= 0 && point.y >= 0 && point.x <= this.size.x && point.y <= this.size.y;
  }

  /** Whether input at a position in this Control's space may reach a direct child. */
  intersectsChildContent (child: Control, position: Vector2): boolean {
    return true;
  }

  getEffectiveMouseFilter (): MouseFilter {
    return this.enabledInHierarchy && this.isMouseRecursiveEnabled() ? this.mouseFilter : MouseFilter.Ignore;
  }

  getFocusModeWithOverride (): FocusMode {
    return this.enabledInHierarchy && this.isFocusRecursiveEnabled() ? this.focusMode : FocusMode.None;
  }

  getCursorShape (position: Vector2): CursorStyle {
    return this.defaultCursorShape;
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

  update (deltaTime: number): void {
    for (const child of this.children.slice()) {
      if (child.enabled && !child.isDisposed) {
        child.update(deltaTime);
      }
    }
  }

  draw (): void {
    // OVERRIDE
  }

  onDestroy (): void {}

  drawInternal (): void {
    if (!this.visibleInHierarchy || this.disposed) {
      return;
    }
    const graphics = this.engine.graphics;

    graphics.pushTransform(this.getTransform2D());
    this.draw();
    this.drawChildren();
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

  measureText (
    text: string, fontSize: number,
    fontFamily?: string, fontWeight?: FontWeight, fontStyle?: FontStyle,
  ): TextMeasurement {
    return this.engine.graphics.measureText(text, fontSize, fontFamily, fontWeight, fontStyle);
  }

  onMouseEnter (location: Vector2): void {}
  onMouseMove (event: InputEventMouseMotion): void {}
  onMouseLeave (): void {}
  onMouseWheel (event: InputEventMouseButton): void {}
  onMouseDown (event: InputEventMouseButton): void {}
  onMouseUp (event: InputEventMouseButton): void {}
  onTouchDown (event: InputEventScreenTouch): void {}
  onTouchMove (event: InputEventScreenDrag): void {}
  onTouchUp (event: InputEventScreenTouch): void {}
  onKeyDown (event: InputEventKey): void {}
  onKeyUp (event: InputEventKey): void {}
  onGotFocus (): void {}
  onLostFocus (): void {}
  onScrollBegin (): void {}
  onScrollEnd (): void {}

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

  dispose (): void {
    if (this.disposed) {
      return;
    }
    for (const child of this.children.slice()) {
      child.dispose();
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
    const top = this.offsetMin.y + this.anchorMin.y * parentSize.y;
    const right = this.offsetMax.x + this.anchorMax.x * parentSize.x;
    const bottom = this.offsetMax.y + this.anchorMax.y * parentSize.y;

    const minimum = this.getBoundMinimumSize();
    const maximum = this.getCombinedMaximumSize();
    const horizontal = this.resolveBoundedAxis(left, right - left, minimum.x, maximum.x, this.horizontalGrowDirection);
    const vertical = this.resolveBoundedAxis(top, bottom - top, minimum.y, maximum.y, this.verticalGrowDirection);

    this.applyBounds(horizontal.position, vertical.position, horizontal.size, vertical.size);
  }

  protected drawChildren (): void {
    const graphics = this.engine.graphics;

    if (this.clipContents) {
      graphics.pushClipRect(0, 0, this.width, this.height);
    }
    for (const child of this.children) {
      child.drawInternal();
    }
    if (this.clipContents) {
      graphics.popClipRect();
    }
  }

  protected onRootChanged (previousRoot: RootControl | null, nextRoot: RootControl | null): void {}
  protected getDragData (position: Vector2): unknown { return null; }
  protected canDropData (position: Vector2, data: unknown): boolean { return false; }
  protected dropData (position: Vector2, data: unknown): void {}

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
      if (!(this instanceof Container)) {
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

  private getCachedMinimumSize (): Vector2 {
    this.minimumSizeCache ??= normalizeMeasuredMinimum(this.getMinimumSize());

    return this.minimumSizeCache.clone();
  }

  private getCachedDesiredSize (): Vector2 {
    this.desiredSizeCache ??= normalizeMeasuredMinimum(this.getDesiredSize());

    return this.desiredSizeCache.clone();
  }

  private getCachedMaximumSize (): Vector2 {
    this.maximumSizeCache ??= normalizeMeasuredMaximum(this.getMaximumSize());

    return this.maximumSizeCache.clone();
  }

  private resolveBoundedAxis (
    position: number,
    requestedSize: number,
    minimumSize: number,
    maximumSize: number,
    growDirection: GrowDirection,
  ): { position: number, size: number } {
    const finiteSize = Number.isFinite(requestedSize) ? requestedSize : 0;
    const size = Math.max(minimumSize, clampToMaximum(finiteSize, maximumSize));
    const difference = size - finiteSize;
    let adjustedPosition = Number.isFinite(position) ? position : 0;

    if (growDirection === GrowDirection.Begin) {
      adjustedPosition -= difference;
    } else if (growDirection === GrowDirection.Both) {
      adjustedPosition -= difference / 2;
    }

    return { position: adjustedPosition, size };
  }

  private assertGrowDirection (value: GrowDirection): void {
    if (!Number.isInteger(value) || value < GrowDirection.Begin || value > GrowDirection.Both) {
      throw new RangeError('Invalid Control grow direction.');
    }
  }

  private queuePendingLayouts (): void {
    if (this instanceof Container) {
      this.queueSort();
    }
    for (const child of this.children) {
      child.queuePendingLayouts();
    }
  }

  private notifyRootChanged (previousRoot: RootControl | null, nextRoot: RootControl | null): void {
    this.onRootChanged(previousRoot, nextRoot);
    for (const child of this.children) {
      child.notifyRootChanged(previousRoot, nextRoot);
    }
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

  fromData (data: ControlData): void {
    if (data.anchorMin !== undefined) {
      this.setAnchorMin(...data.anchorMin);
    }
    if (data.anchorMax !== undefined) {
      this.setAnchorMax(...data.anchorMax);
    }
    if (data.offsetMin !== undefined) {
      this.setOffsetMin(...data.offsetMin);
    }
    if (data.offsetMax !== undefined) {
      this.setOffsetMax(...data.offsetMax);
    }
    if (data.pivot !== undefined) {
      this.setPivot(...data.pivot);
    }
    if (data.scale !== undefined) {
      this.setScale(...data.scale);
    }
    if (data.shear !== undefined) {
      this.setShear(...data.shear);
    }
    if (data.rotation !== undefined) {
      this.setRotation(data.rotation);
    }
    if (data.customMinimumSize !== undefined) {
      this.setCustomMinimumSize(...data.customMinimumSize);
    }
    if (data.customMaximumSize !== undefined) {
      this.setCustomMaximumSize(...data.customMaximumSize);
    }
    if (data.horizontalSizeFlags !== undefined || data.verticalSizeFlags !== undefined) {
      this.setSizeFlags(
        data.horizontalSizeFlags ?? this.horizontalSizeFlags,
        data.verticalSizeFlags ?? this.verticalSizeFlags,
      );
    }
    if (data.stretchRatio !== undefined) {
      this.stretchRatio = data.stretchRatio;
    }
    if (data.horizontalGrowDirection !== undefined) {
      this.horizontalGrowDirection = data.horizontalGrowDirection;
    }
    if (data.verticalGrowDirection !== undefined) {
      this.verticalGrowDirection = data.verticalGrowDirection;
    }
    if (data.mouseFilter !== undefined) {
      this.mouseFilter = data.mouseFilter;
    }
    if (data.mouseBehaviorRecursive !== undefined) {
      this.mouseBehaviorRecursive = data.mouseBehaviorRecursive;
    }
    if (data.mouseForcePassScrollEvents !== undefined) {
      this.mouseForcePassScrollEvents = data.mouseForcePassScrollEvents;
    }
    if (data.focusMode !== undefined) {
      this.focusMode = data.focusMode;
    }
    if (data.focusBehaviorRecursive !== undefined) {
      this.focusBehaviorRecursive = data.focusBehaviorRecursive;
    }
    if (data.defaultCursorShape !== undefined) {
      this.defaultCursorShape = data.defaultCursorShape;
    }
    if (data.clipContents !== undefined) {
      this.clipContents = data.clipContents;
    }
  }
}

/**
 * A Control that automatically measures and arranges its child Controls.
 * Concrete layout algorithms live in GUI plugin packages.
 */
@effectsClass('Container')
export class Container extends Control {
  private sortPending = false;
  private readonly childLayoutChanged = () => this.invalidateMeasurementsAndQueueSort();
  private readonly ownSizeChanged = () => this.queueSort();

  constructor (engine: Engine) {
    super(engine);
    this.on('sizeChanged', this.ownSizeChanged);
  }

  /** Defers and coalesces a layout pass until the GUI update phase. */
  queueSort (): void {
    const root = this.root;

    if (!root || this.sortPending) {
      return;
    }
    this.sortPending = true;
    root.queueLayout(this);
  }

  /** @internal */
  invokeSortChildren (): void {
    if (!this.sortPending || this.isDisposed) {
      return;
    }
    this.sortChildren();
    this.sortPending = false;
  }

  override changeChildIndex (child: Control, newIndex: number): void {
    const previousIndex = this.getChildIndex(child);

    super.changeChildIndex(child, newIndex);
    if (previousIndex !== this.getChildIndex(child)) {
      this.invalidateMeasurementsAndQueueSort();
    }
  }

  override addChildInternal (child: Control): void {
    const wasChild = this.children.includes(child);

    super.addChildInternal(child);
    if (!wasChild) {
      this.bindChild(child);
      this.invalidateMeasurementsAndQueueSort();
    }
  }

  override removeChildInternal (child: Control): void {
    const wasChild = this.children.includes(child);

    if (wasChild) {
      this.unbindChild(child);
    }
    super.removeChildInternal(child);
    if (wasChild) {
      this.invalidateMeasurementsAndQueueSort();
    }
  }

  override dispose (): void {
    this.off('sizeChanged', this.ownSizeChanged);
    for (const child of this.children.slice()) {
      this.unbindChild(child);
    }
    super.dispose();
  }

  /**
   * Applies size flags and strict container geometry to a child. Automatic
   * layout owns anchors, rotation, scale and shear; pivot is intentionally kept.
   */
  fitChildInRect (child: Control, rect: Rect): void {
    const minimum = child.getBoundMinimumSize();
    const desired = child.getBoundDesiredSize();
    const maximum = child.getCombinedMaximumSize();
    const horizontal = this.fitAxis(
      rect.position.x,
      rect.size.x,
      minimum.x,
      desired.x,
      maximum.x,
      child.horizontalSizeFlags,
    );
    const vertical = this.fitAxis(
      rect.position.y,
      rect.size.y,
      minimum.y,
      desired.y,
      maximum.y,
      child.verticalSizeFlags,
    );

    child.anchorMin.set(0, 0);
    child.anchorMax.set(0, 0);
    child.setRotation(0);
    child.setScale(1, 1);
    child.setShear(0, 0);
    child.setRect({
      position: new Vector2(horizontal.position, vertical.position),
      size: new Vector2(horizontal.size, vertical.size),
    });
  }

  /** Returns direct children that participate in layout. Disabled children still participate. */
  protected getLayoutChildren (): Control[] {
    return this.children.filter(child => child.visible && !child.isDisposed);
  }

  protected sortChildren (): void {}

  private bindChild (child: Control): void {
    child.on('minimumSizeChanged', this.childLayoutChanged);
    child.on('desiredSizeChanged', this.childLayoutChanged);
    child.on('maximumSizeChanged', this.childLayoutChanged);
    child.on('sizeFlagsChanged', this.childLayoutChanged);
    child.on('visibilityChanged', this.childLayoutChanged);
  }

  private unbindChild (child: Control): void {
    child.off('minimumSizeChanged', this.childLayoutChanged);
    child.off('desiredSizeChanged', this.childLayoutChanged);
    child.off('maximumSizeChanged', this.childLayoutChanged);
    child.off('sizeFlagsChanged', this.childLayoutChanged);
    child.off('visibilityChanged', this.childLayoutChanged);
  }

  private invalidateMeasurementsAndQueueSort (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.updateMaximumSize();
    this.queueSort();
  }

  private fitAxis (
    position: number,
    available: number,
    minimum: number,
    desired: number,
    maximum: number,
    flags: SizeFlags,
  ): { position: number, size: number } {
    const wantsFill = (flags & SizeFlags.Fill) !== 0;
    let size = wantsFill ? available : Math.min(available, desired);

    size = Math.max(minimum, clampToMaximum(size, maximum));
    const remaining = available - size;
    let adjustedPosition = position;

    if ((flags & SizeFlags.ShrinkEnd) !== 0) {
      adjustedPosition += remaining;
    } else if ((flags & SizeFlags.ShrinkCenter) !== 0) {
      adjustedPosition += remaining / 2;
    }

    return { position: adjustedPosition, size };
  }
}

/** Base class for GUI tree roots and input dispatchers. */
export abstract class RootControl extends Control {
  protected readonly rootEventEmitter = new EventEmitter<RootControlEvent>();

  override on<E extends keyof RootControlEvent> (
    eventName: E,
    listener: EventEmitterListener<RootControlEvent[E]>,
  ): void {
    if (eventName === 'guiFocusChanged') {
      this.rootEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof RootControlEvent> (
    eventName: E,
    listener: EventEmitterListener<RootControlEvent[E]>,
  ): void {
    if (eventName === 'guiFocusChanged') {
      this.rootEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  abstract queueLayout (container: Container): void;
  abstract getMousePosition (): Vector2;
  abstract guiGetFocusOwner (): Control | null;
  abstract guiIsDragging (): boolean;
  abstract guiGetDragData (): unknown;
  abstract guiIsDragSuccessful (): boolean;
  abstract guiCancelDrag (): void;
  abstract cancelPointerInput (): void;
  abstract cancelPointerPress (control: Control, touchIndex: number): void;
  abstract grabControlFocus (control: Control): void;
  abstract grabControlClickFocus (control: Control): void;
  abstract releaseControlFocus (control?: Control): void;
  abstract warpControlMouse (position: Vector2): void;
  abstract updateMouseCursorState (): void;
  abstract controlStateChanged (control: Control): void;
  abstract controlRemoved (control: Control): void;
  abstract controlTreeChanged (): void;
}
