import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { UICanvas } from '../components/ui-canvas';
import type { Engine } from '../engine';
import {
  CursorShape,
  FocusMode,
  InputEventKey,
  InputEventMouse,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
} from '../input';
import type { CursorStyle, InputEvent } from '../input';
import type { Container } from './control';
import { Control, RootControl } from './control';

const cursorNames: Record<CursorShape, string> = {
  [CursorShape.Arrow]: 'default',
  [CursorShape.Ibeam]: 'text',
  [CursorShape.PointingHand]: 'pointer',
  [CursorShape.Cross]: 'crosshair',
  [CursorShape.Wait]: 'wait',
  [CursorShape.Busy]: 'progress',
  [CursorShape.Drag]: 'grab',
  [CursorShape.CanDrop]: 'copy',
  [CursorShape.Forbidden]: 'not-allowed',
  [CursorShape.Vsize]: 'ns-resize',
  [CursorShape.Hsize]: 'ew-resize',
  [CursorShape.Bdiagsize]: 'nesw-resize',
  [CursorShape.Fdiagsize]: 'nwse-resize',
  [CursorShape.Move]: 'move',
  [CursorShape.Vsplit]: 'row-resize',
  [CursorShape.Hsplit]: 'col-resize',
  [CursorShape.Help]: 'help',
};

function getButtonMask (button: MouseButton): number {
  switch (button) {
    case MouseButton.Left: return MouseButtonMask.Left;
    case MouseButton.Right: return MouseButtonMask.Right;
    case MouseButton.Middle: return MouseButtonMask.Middle;
    case MouseButton.Xbutton1: return MouseButtonMask.Xbutton1;
    case MouseButton.Xbutton2: return MouseButtonMask.Xbutton2;
    default: return MouseButtonMask.None;
  }
}

function isWheelButton (button: MouseButton): boolean {
  return button >= MouseButton.WheelUp && button <= MouseButton.WheelRight;
}

type GUIState = {
  mouseFocus: Control | null,
  mouseClickGrabber: Control | null,
  mouseFocusMask: number,
  mouseOver: Control | null,
  mouseOverHierarchy: Control[],
  touchFocus: Map<number, Control>,
  keyFocus: Control | null,
  dragAccum: Vector2,
  dragAttempted: boolean,
  dragging: boolean,
  dragData: unknown,
  dragMouseOver: Control | null,
  dragSuccessful: boolean,
  lastMousePosition: Vector2,
  sendingMouseEnterExit: boolean,
  mouseOverUpdatePending: boolean,
};

/** CanvasLayer-like boundary for a single UICanvas GUI tree. */
export class CanvasRootControl extends Control {
  readonly canvas: UICanvas;

  constructor (engine: Engine, canvas: UICanvas) {
    super(engine);
    this.canvas = canvas;
    this.mouseFilter = MouseFilter.Ignore;
    this.setSize(engine.canvas.width, engine.canvas.height);
  }

  get inputDisabled (): boolean {
    return !this.canvas.receivesEvents || !this.canvas.enabled || !this.canvas.item?.isActive;
  }
}

/** Global ordered collection of UICanvas roots. */
export class CanvasContainer extends Control {
  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    this.setSize(engine.canvas.width, engine.canvas.height);
  }

  sortCanvases (): void {
    this.children.sort((left, right) =>
      (left as CanvasRootControl).canvas.order - (right as CanvasRootControl).canvas.order);
  }

  override addChildInternal (child: Control): void {
    super.addChildInternal(child);
    child.setSize(this.width, this.height);
    this.sortCanvases();
  }

  protected override drawChildren (): void {
    this.sortCanvases();
    const graphics = this.engine.graphics;

    if (this.clipContents) {
      graphics.pushClipRect(0, 0, this.width, this.height);
    }
    for (const child of this.children) {
      const root = child as CanvasRootControl;

      if (root.canvas.isVisible) {
        root.drawInternal();
      }
    }
    if (this.clipContents) {
      graphics.popClipRect();
    }
  }

}

/** Engine window GUI root. Routes events across all UICanvas roots. */
export class WindowRootControl extends RootControl {
  readonly canvases: CanvasContainer;
  dragThreshold = 10;
  private lastInput: InputEvent | null = null;
  private readonly dirtyContainers = new Set<Container>();
  private readonly gui: GUIState = {
    mouseFocus: null,
    mouseClickGrabber: null,
    mouseFocusMask: MouseButtonMask.None,
    mouseOver: null,
    mouseOverHierarchy: [],
    touchFocus: new Map(),
    keyFocus: null,
    dragAccum: new Vector2(),
    dragAttempted: false,
    dragging: false,
    dragData: null,
    dragMouseOver: null,
    dragSuccessful: false,
    lastMousePosition: new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
    sendingMouseEnterExit: false,
    mouseOverUpdatePending: false,
  };

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    this.setSize(engine.canvas.width, engine.canvas.height);
    this.canvases = new CanvasContainer(engine);
    this.canvases.parent = this;
  }

  pushInput (event: InputEvent): void {
    event.clearAccepted();
    this.lastInput = event;
    this.cleanupInternalState();
    this.processGUIInput(event);
    this.postGrabClickFocus();
  }

  isInputHandled (): boolean {
    return this.lastInput?.isAccepted() ?? false;
  }

  override getMousePosition (): Vector2 {
    return this.gui.lastMousePosition.clone();
  }

  override guiGetFocusOwner (): Control | null {
    return this.isFocusTargetUsable(this.gui.keyFocus) ? this.gui.keyFocus : null;
  }

  guiReleaseFocus (): void {
    this.releaseControlFocus();
  }

  override guiIsDragging (): boolean {
    return this.gui.dragging;
  }

  override guiGetDragData (): unknown {
    return this.gui.dragData;
  }

  override guiIsDragSuccessful (): boolean {
    return this.gui.dragSuccessful;
  }

  override guiCancelDrag (): void {
    this.endDragging(false);
  }

  override grabControlFocus (control: Control): void {
    if (!this.isFocusTargetUsable(control) || this.gui.keyFocus === control) {
      return;
    }
    const previous = this.gui.keyFocus;

    this.gui.keyFocus = control;
    if (previous && !previous.isDisposed) {
      previous.onLostFocus();
    }
    control.onGotFocus();
    this.notifyFocusOwnerChanged(control);
  }

  override grabControlClickFocus (control: Control): void {
    if (this.isControlValid(control)) {
      this.gui.mouseClickGrabber = control;
      queueMicrotask(() => this.postGrabClickFocus());
    }
  }

  override releaseControlFocus (control?: Control): void {
    const previous = this.gui.keyFocus;

    if (!previous || (control && previous !== control)) {
      return;
    }
    this.gui.keyFocus = null;
    if (!previous.isDisposed) {
      previous.onLostFocus();
    }
    this.notifyFocusOwnerChanged(null);
  }

  override warpControlMouse (position: Vector2): void {
    this.gui.lastMousePosition.copyFrom(position);
    this.updateMouseOver(position);
    this.updateMouseCursorState();
  }

  override updateMouseCursorState (): void {
    const position = this.gui.lastMousePosition;
    const target = this.isControlUsable(this.gui.mouseFocus)
      ? this.gui.mouseFocus
      : this.isControlUsable(this.gui.mouseOver)
        ? this.gui.mouseOver
        : null;

    this.updateCursor(target, position);
  }

  override controlStateChanged (control: Control): void {
    if (!this.isControlUsable(control)) {
      this.dropControlState(control);
    }
    this.requestMouseOverUpdate();
  }

  override controlRemoved (control: Control): void {
    this.dropControlState(control);
    this.cleanupInternalState();
    this.requestMouseOverUpdate();
  }

  override controlTreeChanged (): void {
    this.requestMouseOverUpdate();
  }

  override queueLayout (container: Container): void {
    if (!container.isDisposed) {
      this.dirtyContainers.add(container);
    }
  }

  override cancelPointerInput (): void {
    this.dropMouseFocus();
    this.dropMouseOver();
    this.gui.touchFocus.clear();
    this.endDragging(false);
    this.releaseControlFocus();
  }

  override cancelPointerPress (control: Control, touchIndex: number): void {
    if (!this.isControlValid(control)) {
      return;
    }
    if (this.controlBelongsToSubtree(this.gui.mouseFocus, control)) {
      this.gui.mouseFocus = control;
    }
    if (this.controlBelongsToSubtree(this.gui.mouseClickGrabber, control)) {
      this.gui.mouseClickGrabber = null;
    }
    if (this.controlBelongsToSubtree(this.gui.touchFocus.get(touchIndex) ?? null, control)) {
      this.gui.touchFocus.set(touchIndex, control);
    }
    this.endDragging(false);
  }

  resize (width: number, height: number): void {
    this.setSize(width, height);
    this.canvases.setSize(width, height);
    for (const root of this.canvases.children as CanvasRootControl[]) {
      root.setSize(width, height);
    }
  }

  render (): void {
    this.flushLayout();
    if (this.canvases.children.length === 0) {
      return;
    }
    this.engine.graphics.begin();
    this.drawInternal();
    this.engine.graphics.end();
  }

  override update (deltaTime: number): void {
    if (this.gui.mouseOverUpdatePending) {
      this.gui.mouseOverUpdatePending = false;
      this.updateMouseOver(this.gui.lastMousePosition);
    }
    super.update(deltaTime);
    this.flushLayout();
  }

  override dispose (): void {
    this.cancelPointerInput();
    this.dirtyContainers.clear();
    super.dispose();
  }

  private flushLayout (): void {
    let round = 0;

    while (this.dirtyContainers.size > 0) {
      if (round++ >= 32) {
        this.dirtyContainers.clear();
        throw new Error('GUI layout did not converge after 32 rounds.');
      }
      const batch = Array.from(this.dirtyContainers);

      this.dirtyContainers.clear();
      batch.sort((left, right) => this.getControlDepth(left) - this.getControlDepth(right));
      for (const container of batch) {
        if (container.root === this && !container.isDisposed) {
          container.invokeSortChildren();
        }
      }
    }
  }

  private getControlDepth (control: Control): number {
    let depth = 0;
    let parent = control.parent;

    while (parent) {
      depth++;
      parent = parent.parent;
    }

    return depth;
  }

  private processGUIInput (event: InputEvent): void {
    if (event instanceof InputEventKey) {
      const target = this.guiGetFocusOwner();

      if (target) {
        this.callControlInput(target, event);
      }
    } else if (event instanceof InputEventMouse) {
      this.gui.lastMousePosition.copyFrom(event.globalPosition);
      this.updateMouseOver(event.globalPosition);
      if (event instanceof InputEventMouseButton) {
        this.processMouseButton(event);
      } else if (event instanceof InputEventMouseMotion) {
        this.processMouseMotion(event);
      }
    } else if (event instanceof InputEventScreenTouch) {
      this.processScreenTouch(event);
    } else if (event instanceof InputEventScreenDrag) {
      this.processScreenDrag(event);
    }
  }

  private processMouseButton (event: InputEventMouseButton): void {
    if (isWheelButton(event.buttonIndex)) {
      const target = this.findInputControl(event.globalPosition);

      if (target) {
        this.callGUIInput(target, event);
      }

      return;
    }
    const mask = getButtonMask(event.buttonIndex);

    if (event.isPressed()) {
      const target = this.gui.mouseFocusMask !== 0
        ? this.gui.mouseFocus
        : this.findInputControl(event.globalPosition);

      this.gui.mouseFocus = target;
      if (!target) {
        return;
      }
      this.gui.mouseFocusMask |= mask;
      if (event.buttonIndex === MouseButton.Left) {
        this.gui.dragAccum.setZero();
        this.gui.dragAttempted = false;
        this.findClickFocus(target);
      }
      this.callGUIInput(target, event);
    } else {
      if (event.buttonIndex === MouseButton.Left && this.gui.dragging) {
        this.finishDrop(event.globalPosition);
      }
      this.gui.mouseFocusMask &= ~mask;
      const target = this.gui.mouseFocus;

      if (this.gui.mouseFocusMask === 0) {
        this.gui.mouseFocus = null;
      }
      if (this.isControlUsable(target)) {
        this.callGUIInput(target, event);
      }
    }
  }

  private processMouseMotion (event: InputEventMouseMotion): void {
    if (!this.gui.dragging && !this.gui.dragAttempted && this.gui.mouseFocus &&
      (this.gui.mouseFocusMask & MouseButtonMask.Left) !== 0) {
      this.gui.dragAccum.add(event.relative);
      if (this.gui.dragAccum.length() > this.dragThreshold) {
        const origin = event.globalPosition.clone().subtract(this.gui.dragAccum);

        this.beginDragging(this.gui.mouseFocus, origin);
        this.gui.dragAttempted = true;
      }
    }
    const target = this.isControlUsable(this.gui.mouseFocus)
      ? this.gui.mouseFocus
      : this.findInputControl(event.globalPosition);

    if (target) {
      this.callGUIInput(target, event);
    }
    if (this.gui.dragging) {
      this.gui.dragMouseOver = this.findDropTarget(this.findInputControl(event.globalPosition), event.globalPosition);
    }
    this.updateCursor(target, event.globalPosition);
  }

  private processScreenTouch (event: InputEventScreenTouch): void {
    let target: Control | null;

    if (event.isPressed()) {
      target = this.findInputControl(event.position);
      if (target) {
        this.gui.touchFocus.set(event.index, target);
      }
    } else {
      target = this.gui.touchFocus.get(event.index) ?? null;
      this.gui.touchFocus.delete(event.index);
    }
    if (this.isControlUsable(target)) {
      this.callGUIInput(target, event);
    }
  }

  private processScreenDrag (event: InputEventScreenDrag): void {
    const target = this.gui.touchFocus.get(event.index) ?? this.findInputControl(event.position);

    if (this.isControlUsable(target)) {
      this.callGUIInput(target, event);
    }
  }

  private callGUIInput (target: Control, event: InputEvent): void {
    let current: Control | null = target;
    const pointerEvent = event instanceof InputEventMouse || event instanceof InputEventScreenTouch ||
      event instanceof InputEventScreenDrag;

    while (current && current !== this && this.isControlUsable(current)) {
      const filter = current.getEffectiveMouseFilter();

      if (filter !== MouseFilter.Ignore) {
        const localEvent = event.xformedBy(this.getGlobalInverse(current));

        this.callControlInput(current, localEvent);
        if (localEvent.isAccepted()) {
          event.accept();
        }
      }
      const forcePassWheel = event instanceof InputEventMouseButton && isWheelButton(event.buttonIndex) &&
        current.mouseForcePassScrollEvents;
      const forcePassTouch = (event instanceof InputEventScreenTouch || event instanceof InputEventScreenDrag) &&
        current.mouseForcePassScrollEvents;

      if (event.isAccepted() || (filter === MouseFilter.Stop && pointerEvent && !forcePassWheel && !forcePassTouch)) {
        event.accept();

        return;
      }
      current = current.parent;
    }
  }

  private callControlInput (control: Control, event: InputEvent): void {
    if (event instanceof InputEventMouseButton) {
      if (isWheelButton(event.buttonIndex)) {
        control.onMouseWheel(event);
      } else if (event.isPressed()) {
        control.onMouseDown(event);
      } else {
        control.onMouseUp(event);
      }
    } else if (event instanceof InputEventMouseMotion) {
      control.onMouseMove(event);
    } else if (event instanceof InputEventScreenTouch) {
      if (event.isPressed()) {
        control.onTouchDown(event);
      } else {
        control.onTouchUp(event);
      }
    } else if (event instanceof InputEventScreenDrag) {
      control.onTouchMove(event);
    } else if (event instanceof InputEventKey) {
      if (event.isPressed()) {
        control.onKeyDown(event);
      } else if (event.isReleased()) {
        control.onKeyUp(event);
      }
    }
  }

  private findInputControl (position: Vector2): Control | null {
    this.canvases.sortCanvases();
    for (let index = this.canvases.children.length - 1; index >= 0; index--) {
      const root = this.canvases.children[index] as CanvasRootControl;

      if (!root.canvas.isVisible || root.inputDisabled) {
        continue;
      }
      const target = this.findControlAtPosition(root, position, true);

      if (target) {
        return target;
      }
    }

    return null;
  }

  private findControlAtPosition (container: Control, position: Vector2, skipSelf = false): Control | null {
    if (!container.visibleInHierarchy || container.isDisposed) {
      return null;
    }
    const localPosition = this.toLocal(container, position);

    if (container.clipContents && !container.hasPoint(localPosition)) {
      return null;
    }
    for (let index = container.children.length - 1; index >= 0; index--) {
      const child = container.children[index];

      if (!child.visibleInHierarchy || child.isDisposed) {
        continue;
      }
      if (!container.intersectsChildContent(child, localPosition)) {
        continue;
      }
      const found = this.findControlAtPosition(child, position);

      if (found) {
        return found;
      }
    }
    if (!skipSelf && container.getEffectiveMouseFilter() !== MouseFilter.Ignore && container.hasPoint(localPosition)) {
      return container;
    }

    return null;
  }

  private updateMouseOver (position: Vector2): void {
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;

      return;
    }
    this.gui.mouseOverUpdatePending = false;
    const target = this.findInputControl(position);
    const next = this.buildHoverHierarchy(target);
    const previous = this.gui.mouseOverHierarchy;
    let common = 0;

    while (common < previous.length && common < next.length && previous[common] === next[common]) {
      common++;
    }
    this.gui.sendingMouseEnterExit = true;
    for (let index = previous.length - 1; index >= common; index--) {
      if (!previous[index].isDisposed) {
        previous[index].onMouseLeave();
      }
    }
    for (let index = common; index < next.length; index++) {
      next[index].onMouseEnter(this.toLocal(next[index], position));
    }
    this.gui.sendingMouseEnterExit = false;
    this.gui.mouseOver = target;
    this.gui.mouseOverHierarchy = next;
  }

  private buildHoverHierarchy (target: Control | null): Control[] {
    const hierarchy: Control[] = [];
    let current = target;

    while (current && current !== this) {
      if (current.getEffectiveMouseFilter() !== MouseFilter.Ignore) {
        hierarchy.push(current);
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
        break;
      }
      current = current.parent;
    }
    hierarchy.reverse();

    return hierarchy;
  }

  private findClickFocus (target: Control): void {
    let current: Control | null = target;

    while (current && current !== this) {
      const mode = current.getFocusModeWithOverride();

      if (mode === FocusMode.Click || mode === FocusMode.All) {
        this.grabControlFocus(current);

        return;
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
        return;
      }
      current = current.parent;
    }
  }

  private beginDragging (source: Control, position: Vector2): void {
    let current: Control | null = source;

    while (current && current !== this) {
      const data = current.invokeGetDragData(this.toLocal(current, position));

      if (data !== null && data !== undefined) {
        this.gui.dragging = true;
        this.gui.dragData = data;
        this.gui.mouseFocus = null;
        this.gui.mouseFocusMask = MouseButtonMask.None;

        return;
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
        return;
      }
      current = current.parent;
    }
  }

  private finishDrop (position: Vector2): void {
    const target = this.findDropTarget(this.findInputControl(position), position);

    if (target) {
      target.invokeDropData(this.toLocal(target, position), this.gui.dragData);
    }
    this.endDragging(!!target);
  }

  private findDropTarget (target: Control | null, position: Vector2): Control | null {
    let current = target;

    while (current && current !== this) {
      if (current.invokeCanDropData(this.toLocal(current, position), this.gui.dragData)) {
        return current;
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
        return null;
      }
      current = current.parent;
    }

    return null;
  }

  private endDragging (successful: boolean): void {
    this.gui.dragSuccessful = successful;
    this.gui.dragging = false;
    this.gui.dragData = null;
    this.gui.dragMouseOver = null;
  }

  private updateCursor (target: Control | null, position: Vector2): void {
    let current = target;
    let cursor: CursorStyle = CursorShape.Arrow;

    while (current && current !== this) {
      const candidate = current.getCursorShape(this.toLocal(current, position));

      if (candidate !== CursorShape.Arrow) {
        cursor = candidate;

        break;
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
        break;
      }
      current = current.parent;
    }
    this.engine.canvas.style.cursor = typeof cursor === 'string' ? cursor : cursorNames[cursor];
  }

  private postGrabClickFocus (): void {
    const target = this.gui.mouseClickGrabber;

    this.gui.mouseClickGrabber = null;
    if (this.isControlUsable(target)) {
      this.gui.mouseFocus = target;
    }
  }

  private cleanupInternalState (): void {
    if (!this.isControlUsable(this.gui.mouseFocus)) {
      this.dropMouseFocus();
    }
    if (this.gui.keyFocus && !this.isFocusTargetUsable(this.gui.keyFocus)) {
      this.releaseControlFocus(this.gui.keyFocus);
    }
    for (const [index, control] of this.gui.touchFocus) {
      if (!this.isControlUsable(control)) {
        this.gui.touchFocus.delete(index);
      }
    }
  }

  private dropMouseFocus (): void {
    this.gui.mouseFocus = null;
    this.gui.mouseFocusMask = MouseButtonMask.None;
  }

  private dropMouseOver (): void {
    for (let index = this.gui.mouseOverHierarchy.length - 1; index >= 0; index--) {
      const control = this.gui.mouseOverHierarchy[index];

      if (!control.isDisposed) {
        control.onMouseLeave();
      }
    }
    this.gui.mouseOver = null;
    this.gui.mouseOverHierarchy = [];
  }

  private dropControlState (control: Control): void {
    if (this.controlBelongsToSubtree(this.gui.mouseFocus, control)) {
      this.dropMouseFocus();
    }
    if (this.controlBelongsToSubtree(this.gui.mouseClickGrabber, control)) {
      this.gui.mouseClickGrabber = null;
    }
    if (this.controlBelongsToSubtree(this.gui.keyFocus, control)) {
      this.releaseControlFocus(this.gui.keyFocus ?? undefined);
    }
    if (this.controlBelongsToSubtree(this.gui.mouseOver, control)) {
      this.dropMouseOver();
    }
    if (this.controlBelongsToSubtree(this.gui.dragMouseOver, control)) {
      this.gui.dragMouseOver = null;
    }
    for (const [index, target] of this.gui.touchFocus) {
      if (this.controlBelongsToSubtree(target, control)) {
        this.gui.touchFocus.delete(index);
      }
    }
  }

  private requestMouseOverUpdate (): void {
    if (Number.isFinite(this.gui.lastMousePosition.x)) {
      this.updateMouseOver(this.gui.lastMousePosition);
    }
  }

  private getGlobalInverse (control: Control): Matrix3 {
    const transform = control.getGlobalTransform2D().clone();

    return Math.abs(transform.determinant()) < 1e-12 ? new Matrix3() : transform.invert();
  }

  private toLocal (control: Control, position: Vector2): Vector2 {
    const elements = this.getGlobalInverse(control).elements;

    return new Vector2(
      elements[0] * position.x + elements[3] * position.y + elements[6],
      elements[1] * position.x + elements[4] * position.y + elements[7],
    );
  }

  private controlBelongsToSubtree (control: Control | null, subtree: Control): boolean {
    let current = control;

    while (current) {
      if (current === subtree) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  private isControlValid (control: Control | null): control is Control {
    return !!control && !control.isDisposed && control.root === this;
  }

  private isControlUsable (control: Control | null): control is Control {
    if (!this.isControlValid(control) || !control.visibleInHierarchy || !control.enabledInHierarchy) {
      return false;
    }
    const root = this.findCanvasRoot(control);

    return !root || !root.inputDisabled;
  }

  private findCanvasRoot (control: Control): CanvasRootControl | null {
    let current: Control | null = control;

    while (current && current !== this) {
      if (current instanceof CanvasRootControl) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  private notifyFocusOwnerChanged (control: Control | null): void {
    this.rootEventEmitter.emit('guiFocusChanged', control);
  }

  private isFocusTargetUsable (control: Control | null): control is Control {
    return this.isControlUsable(control) && control.getFocusModeWithOverride() !== FocusMode.None;
  }
}
