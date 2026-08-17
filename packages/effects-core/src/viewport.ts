import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { CanvasItem } from './components/canvas-item';
import { Control } from './components/control';
import type { Engine } from './engine';
import {
  CursorShape,
  FocusMode,
  InputEvent,
  InputEventKey,
  InputEventMouse,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
} from './input';

type GUIState = {
  mouseFocus: Control | null,
  mouseClickGrabber: Control | null,
  mouseFocusMask: number,
  mouseOver: Control | null,
  mouseOverHierarchy: Control[],
  touchFocus: Map<number, Control>,
  keyFocus: Control | null,
  hideFocus: boolean,
  dragMouseOver: Control | null,
  dragAccum: Vector2,
  dragAttempted: boolean,
  dragging: boolean,
  globalDragging: boolean,
  dragData: unknown,
  dragPreview: Control | null,
  dragSuccessful: boolean,
  lastMousePosition: Vector2,
  roots: Control[],
  rootsOrderDirty: boolean,
  sendingMouseEnterExit: boolean,
  mouseOverUpdatePending: boolean,
};

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
    case MouseButton.Left:
      return MouseButtonMask.Left;
    case MouseButton.Right:
      return MouseButtonMask.Right;
    case MouseButton.Middle:
      return MouseButtonMask.Middle;
    case MouseButton.Xbutton1:
      return MouseButtonMask.Xbutton1;
    case MouseButton.Xbutton2:
      return MouseButtonMask.Xbutton2;
    default:
      return MouseButtonMask.None;
  }
}

function isWheelButton (button: MouseButton): boolean {
  return button >= MouseButton.WheelUp && button <= MouseButton.WheelRight;
}

function getWheelDelta (event: InputEventMouseButton): number {
  return event.buttonIndex === MouseButton.WheelUp || event.buttonIndex === MouseButton.WheelLeft
    ? event.factor
    : -event.factor;
}

export class Viewport {
  dragThreshold = 10;

  private localInputHandled = false;
  private readonly gui: GUIState = {
    mouseFocus: null,
    mouseClickGrabber: null,
    mouseFocusMask: MouseButtonMask.None,
    mouseOver: null,
    mouseOverHierarchy: [],
    touchFocus: new Map(),
    keyFocus: null,
    hideFocus: false,
    dragMouseOver: null,
    dragAccum: new Vector2(),
    dragAttempted: false,
    dragging: false,
    globalDragging: false,
    dragData: null,
    dragPreview: null,
    dragSuccessful: false,
    lastMousePosition: new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY),
    roots: [],
    rootsOrderDirty: true,
    sendingMouseEnterExit: false,
    mouseOverUpdatePending: false,
  };
  private readonly rootControls = new Set<Control>();

  constructor (readonly engine: Engine) { }

  pushInput (event: InputEvent): void {
    this.localInputHandled = false;
    this.gui.rootsOrderDirty = true;
    this.cleanupInternalState();
    this.localInputHandled = false;
    this.processGUIInput(event);
    this.postGrabClickFocus();
  }

  setInputAsHandled (): void {
    this.localInputHandled = true;
  }

  /** @internal */
  acceptEvent (control: Control): void {
    if (this.isControlValid(control) && control.item.composition) {
      this.setInputAsHandled();
    }
  }

  isInputHandled (): boolean {
    return this.localInputHandled;
  }

  guiFindControl (position: Vector2): Control | null {
    this.sortRoots();

    for (let index = this.gui.roots.length - 1; index >= 0; index--) {
      const root = this.gui.roots[index];

      if (!this.isControlValid(root) || !root.item.composition?.interactive) {
        continue;
      }
      const found = this.findControlAtPosition(root, position);

      if (found) {
        return found;
      }
    }

    return null;
  }

  guiGetFocusOwner (): Control | null {
    return this.isControlValid(this.gui.keyFocus) ? this.gui.keyFocus : null;
  }

  guiReleaseFocus (): void {
    this.releaseFocus();
  }

  guiIsDragging (): boolean {
    return this.gui.globalDragging;
  }

  guiGetDragData (): unknown {
    return this.gui.dragData;
  }

  guiIsDragSuccessful (): boolean {
    return this.gui.dragSuccessful;
  }

  guiCancelDrag (): void {
    if (this.gui.globalDragging) {
      this.endDragging(false);
    }
  }

  /** @internal */
  addRootControl (control: Control): void {
    this.rootControls.add(control);
    if (!this.gui.roots.includes(control)) {
      this.gui.roots.push(control);
    }
    this.gui.rootsOrderDirty = true;
    this.requestMouseOverUpdate();
  }

  /** @internal */
  removeRootControl (control: Control): void {
    this.rootControls.delete(control);
    const index = this.gui.roots.indexOf(control);

    if (index !== -1) {
      this.gui.roots.splice(index, 1);
    }
    this.gui.rootsOrderDirty = true;
  }

  /** @internal */
  markRootsOrderDirty (): void {
    this.gui.rootsOrderDirty = true;
    this.requestMouseOverUpdate();
  }

  /** @internal */
  controlStateChanged (control: Control): void {
    this.gui.rootsOrderDirty = true;

    if (!this.isControlUsable(control)) {
      this.dropControlState(control);
    }
    if (this.gui.mouseFocus && !this.isControlUsable(this.gui.mouseFocus)) {
      this.dropMouseFocus();
    }
    if (this.gui.keyFocus && !this.isFocusTargetUsable(this.gui.keyFocus)) {
      this.releaseFocus();
    }
    for (const [index, target] of this.gui.touchFocus) {
      if (!this.isControlUsable(target)) {
        this.gui.touchFocus.delete(index);
      }
    }
    this.requestMouseOverUpdate();
  }

  /** @internal */
  controlRemoved (control: Control): void {
    this.removeRootControl(control);
    this.dropControlState(control);
    this.requestMouseOverUpdate();
  }

  /** @internal */
  grabFocus (control: Control): void {
    if (!this.isFocusTargetUsable(control)) {
      return;
    }
    if (this.gui.keyFocus === control) {
      this.gui.hideFocus = false;

      return;
    }

    const previous = this.gui.keyFocus;

    this.gui.keyFocus = control;
    this.gui.hideFocus = false;
    if (this.isControlValid(previous)) {
      previous.onLostFocus();
    }
    if (this.isFocusTargetUsable(control)) {
      control.onGotFocus();
    }
  }

  /** @internal */
  grabClickFocus (control: Control): void {
    if (this.isControlValid(control)) {
      this.gui.mouseClickGrabber = control;
      queueMicrotask(() => this.postGrabClickFocus());
    }
  }

  /** @internal */
  releaseFocus (control?: Control): void {
    const previous = this.gui.keyFocus;

    if (!previous || (control && previous !== control)) {
      return;
    }
    this.gui.keyFocus = null;
    if (this.isControlValid(previous)) {
      previous.onLostFocus();
    }
  }

  /** @internal */
  warpMouse (position: Vector2): void {
    this.gui.lastMousePosition.copyFrom(position);
    this.updateMouseOver(position);
  }

  /** @internal */
  dispose (): void {
    this.dropMouseFocus();
    this.dropMouseOver();
    this.releaseFocus();
    this.gui.touchFocus.clear();
    this.gui.roots.length = 0;
    this.rootControls.clear();
    if (this.gui.globalDragging) {
      this.endDragging(false);
    }
  }

  /** @internal */
  cancelPointerInput (): void {
    this.dropMouseFocus();
    this.dropMouseOver();
    this.gui.touchFocus.clear();
    if (this.gui.globalDragging) {
      this.endDragging(false);
    }
  }

  private processGUIInput (event: InputEvent): void {
    if (event instanceof InputEventKey) {
      this.processKeyEvent(event);
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

  private processKeyEvent (event: InputEventKey): void {
    const target = this.gui.keyFocus;

    if (!this.isFocusTargetUsable(target)) {
      if (target) {
        this.releaseFocus(target);
      }

      return;
    }
    this.callControlInput(target, event);
  }

  private processMouseButton (event: InputEventMouseButton): void {
    if (isWheelButton(event.buttonIndex)) {
      const target = this.guiFindControl(event.globalPosition);

      if (target) {
        this.callGUIInput(target, event);
      }

      return;
    }

    const buttonMask = getButtonMask(event.buttonIndex);

    if (event.isPressed()) {
      if (event.buttonIndex === MouseButton.Right && this.gui.dragging) {
        this.endDragging(false);
        this.setInputAsHandled();

        return;
      }
      let target: Control | null;
      const buttonAlreadyPressed = (this.gui.mouseFocusMask & buttonMask) !== 0;

      if (this.gui.mouseFocusMask !== 0 && !buttonAlreadyPressed) {
        target = this.gui.mouseFocus;
        if (!target) {
          return;
        }
        this.gui.mouseFocusMask |= buttonMask;
      } else {
        target = this.guiFindControl(event.globalPosition);
        this.gui.mouseFocus = target;
        if (!target) {
          return;
        }
        this.gui.mouseFocusMask |= buttonMask;

        if (event.buttonIndex === MouseButton.Left) {
          this.gui.dragAccum.setZero();
          this.gui.dragAttempted = false;
        }
      }

      if (event.buttonIndex === MouseButton.Left) {
        this.findClickFocus(target);
      }
      this.callGUIInput(target, event);
    } else {
      if (event.buttonIndex === MouseButton.Left && this.gui.dragging) {
        this.finishDrop(event.globalPosition);
      }

      this.gui.mouseFocusMask &= ~buttonMask;
      const target = this.gui.mouseFocus;

      if (!target) {
        return;
      }
      if (this.gui.mouseFocusMask === 0) {
        this.gui.mouseFocus = null;
      }

      if (this.isControlUsable(target)) {
        this.callGUIInput(target, event);
      }
    }
  }

  private processMouseMotion (event: InputEventMouseMotion): void {
    if (!this.gui.dragging && !this.gui.dragAttempted &&
      (this.gui.mouseFocusMask & MouseButtonMask.Left) !== 0 && this.gui.mouseFocus) {
      this.gui.dragAccum.add(event.relative);
      if (this.gui.dragAccum.length() > this.dragThreshold) {
        const dragOrigin = event.globalPosition.clone().subtract(this.gui.dragAccum);

        this.beginDragging(this.gui.mouseFocus, dragOrigin);
        this.gui.dragAttempted = true;
      }
    }

    let target = this.isControlUsable(this.gui.mouseFocus)
      ? this.gui.mouseFocus
      : this.guiFindControl(event.globalPosition);

    if (target) {
      this.callGUIInput(target, event);
    }

    if (this.gui.dragging) {
      target = this.findDropTarget(this.guiFindControl(event.globalPosition), event.globalPosition);
      this.gui.dragMouseOver = target;
    }
    this.updateCursor(target, event.globalPosition);
  }

  private processScreenTouch (event: InputEventScreenTouch): void {
    let target: Control | null;

    if (event.isPressed()) {
      target = this.guiFindControl(event.position);
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
    const target = this.gui.touchFocus.get(event.index) ?? this.guiFindControl(event.position);

    if (this.isControlUsable(target)) {
      this.callGUIInput(target, event);
    }
  }

  private callGUIInput (target: Control, event: InputEvent): void {
    let current: CanvasItem | null = target;
    const isPointerEvent = event instanceof InputEventMouse ||
      event instanceof InputEventScreenDrag || event instanceof InputEventScreenTouch;

    while (current && this.isCanvasItemUsable(current)) {
      if (current instanceof Control) {
        const mouseFilter = current.getEffectiveMouseFilter();

        if (mouseFilter !== MouseFilter.Ignore) {
          const localEvent = event.xformedBy(this.getGlobalInverse(current));

          this.callControlInput(current, localEvent);
        }

        if (!this.isControlValid(current) || current.topLevel) {
          return;
        }
        const forcePassWheel = event instanceof InputEventMouseButton &&
          isWheelButton(event.buttonIndex) && current.mouseForcePassScrollEvents;

        if (current.getEffectiveMouseFilter() === MouseFilter.Stop &&
          isPointerEvent && !forcePassWheel) {
          this.setInputAsHandled();

          return;
        }
      }

      if (this.localInputHandled || current.topLevel) {
        return;
      }
      current = current.parent;
    }
  }

  private callControlInput (control: Control, event: InputEvent): void {
    if (event instanceof InputEventMouseButton) {
      if (isWheelButton(event.buttonIndex)) {
        control.onMouseWheel(event.position, getWheelDelta(event), event);

        return;
      }
      if (event.isPressed()) {
        control.onMouseDown(event.position, event.buttonIndex, event);

        return;
      }

      control.onMouseUp(event.position, event.buttonIndex, event);

      return;
    }
    if (event instanceof InputEventMouseMotion) {
      control.onMouseMove(event.position, event);

      return;
    }
    if (event instanceof InputEventScreenTouch) {
      if (event.isPressed()) {
        control.onTouchDown(event.position, event.index, event);
      } else {
        control.onTouchUp(event.position, event.index, event);
      }

      return;
    }
    if (event instanceof InputEventScreenDrag) {
      control.onTouchMove(event.position, event.index, event);

      return;
    }
    if (event instanceof InputEventKey) {
      if (event.isPressed()) {
        control.onKeyDown(event);
      } else if (event.isReleased()) {
        control.onKeyUp(event);
      }
    }
  }

  private findControlAtPosition (item: CanvasItem, position: Vector2): Control | null {
    if (!item.isActiveInCanvasTree() || !item.item.composition?.interactive) {
      return null;
    }
    if (Math.abs(item.getGlobalTransform2D().determinant()) < 1e-12) {
      return null;
    }

    const control = item instanceof Control ? item : null;
    const localPosition = control ? this.toLocal(control, position) : null;

    if (control?.clipContents && (!localPosition || !control.hasPoint(localPosition))) {
      return null;
    }

    const children = item.children.slice();

    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];

      if (child.topLevel) {
        continue;
      }
      const found = this.findControlAtPosition(child, position);

      if (found) {
        return found;
      }
    }

    if (control && localPosition && control.getEffectiveMouseFilter() !== MouseFilter.Ignore &&
      control.hasPoint(localPosition) && !this.isInDragPreview(control)) {
      return control;
    }

    return null;
  }

  private updateMouseOver (position: Vector2): void {
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;

      return;
    }

    do {
      this.gui.mouseOverUpdatePending = false;
      const target = this.guiFindControl(position);
      const nextHierarchy = this.buildHoverHierarchy(target);
      const previousHierarchy = this.gui.mouseOverHierarchy;
      let common = 0;

      while (common < previousHierarchy.length && common < nextHierarchy.length &&
        previousHierarchy[common] === nextHierarchy[common]) {
        common++;
      }

      this.gui.sendingMouseEnterExit = true;
      for (let index = previousHierarchy.length - 1; index >= common; index--) {
        const control = previousHierarchy[index];

        if (this.isControlValid(control)) {
          control.onMouseLeave();
        }
      }
      for (let index = common; index < nextHierarchy.length; index++) {
        const control = nextHierarchy[index];

        if (this.isMouseTargetUsable(control)) {
          control.onMouseEnter(this.toLocal(control, position));
        }
      }
      this.gui.sendingMouseEnterExit = false;
      this.gui.mouseOver = this.isMouseTargetUsable(target) ? target : null;
      this.gui.mouseOverHierarchy = nextHierarchy.filter(item => this.isMouseTargetUsable(item));
    } while (this.gui.mouseOverUpdatePending);
  }

  private dropMouseOver (): void {
    if (this.gui.mouseOverHierarchy.length === 0) {
      this.gui.mouseOver = null;

      return;
    }

    this.gui.sendingMouseEnterExit = true;
    for (let index = this.gui.mouseOverHierarchy.length - 1; index >= 0; index--) {
      const control = this.gui.mouseOverHierarchy[index];

      if (this.isControlValid(control)) {
        control.onMouseLeave();
      }
    }
    this.gui.sendingMouseEnterExit = false;
    this.gui.mouseOver = null;
    this.gui.mouseOverHierarchy = [];
  }

  private dropMouseFocus (): void {
    const target = this.gui.mouseFocus;
    const mask = this.gui.mouseFocusMask;

    this.gui.mouseFocus = null;
    this.gui.mouseFocusMask = MouseButtonMask.None;

    if (!target || mask === 0 || !this.isControlValid(target)) {
      return;
    }

    const localPosition = this.toLocal(target, this.gui.lastMousePosition);

    for (const [button, buttonMask] of [
      [MouseButton.Left, MouseButtonMask.Left],
      [MouseButton.Right, MouseButtonMask.Right],
      [MouseButton.Middle, MouseButtonMask.Middle],
    ] as const) {
      if ((mask & buttonMask) === 0) {
        continue;
      }
      const event = new InputEventMouseButton();

      event.device = InputEvent.deviceIdInternal;
      event.buttonIndex = button;
      event.pressed = false;
      event.position.copyFrom(localPosition);
      event.globalPosition.copyFrom(localPosition);
      this.callControlInput(target, event);
    }
  }

  private postGrabClickFocus (): void {
    const focusGrabber = this.gui.mouseClickGrabber;

    this.gui.mouseClickGrabber = null;
    if (!this.isControlValid(focusGrabber) || !this.isControlValid(this.gui.mouseFocus) ||
      this.gui.mouseFocus === focusGrabber) {
      return;
    }

    const previous = this.gui.mouseFocus;
    const mask = this.gui.mouseFocusMask;

    this.sendInternalMouseButtons(previous, mask, false);
    if (!this.isControlValid(focusGrabber)) {
      return;
    }
    this.gui.mouseFocus = focusGrabber;
    this.sendInternalMouseButtons(focusGrabber, mask, true);
  }

  private sendInternalMouseButtons (target: Control, mask: number, pressed: boolean): void {
    const localPosition = this.toLocal(target, this.gui.lastMousePosition);

    for (const [button, buttonMask] of [
      [MouseButton.Left, MouseButtonMask.Left],
      [MouseButton.Right, MouseButtonMask.Right],
      [MouseButton.Middle, MouseButtonMask.Middle],
    ] as const) {
      if ((mask & buttonMask) === 0 || !this.isControlValid(target)) {
        continue;
      }
      const event = new InputEventMouseButton();

      event.device = InputEvent.deviceIdInternal;
      event.buttonIndex = button;
      event.pressed = pressed;
      event.position.copyFrom(localPosition);
      event.globalPosition.copyFrom(localPosition);
      this.callControlInput(target, event);
    }
  }

  private cleanupInternalState (): void {
    if (!this.isControlUsable(this.gui.mouseFocus)) {
      this.dropMouseFocus();
    }
    if (!this.isFocusTargetUsable(this.gui.keyFocus)) {
      this.releaseFocus();
    }
    for (const [index, control] of this.gui.touchFocus) {
      if (!this.isControlUsable(control)) {
        this.gui.touchFocus.delete(index);
      }
    }
  }

  private findClickFocus (target: Control | null): void {
    let current: CanvasItem | null = target;

    while (current && this.isCanvasItemUsable(current)) {
      if (current instanceof Control) {
        const mode = current.enabled ? current.getFocusModeWithOverride() : FocusMode.None;

        if (mode === FocusMode.Click || mode === FocusMode.All) {
          if (this.gui.mouseOverHierarchy.includes(current)) {
            this.grabFocus(current);
          }

          return;
        }
        if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
          return;
        }
      }
      if (current.topLevel) {
        return;
      }
      current = current.parent;
    }
  }

  private beginDragging (source: Control, position: Vector2): void {
    let current: CanvasItem | null = source;

    while (current && this.isCanvasItemUsable(current)) {
      if (current instanceof Control) {
        this.gui.globalDragging = true;
        const data = current.invokeGetDragData(this.toLocal(current, position));

        if (!this.isControlValid(current)) {
          this.gui.globalDragging = false;

          return;
        }
        if (data !== null && data !== undefined) {
          this.gui.dragging = true;
          this.gui.dragData = data;
          this.gui.mouseFocus = null;
          this.gui.mouseFocusMask = MouseButtonMask.None;

          return;
        }
        this.gui.globalDragging = false;
        if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
          return;
        }
      }
      if (current.topLevel) {
        return;
      }
      current = current.parent;
    }
  }

  private finishDrop (position: Vector2): void {
    const target = this.findDropTarget(this.guiFindControl(position), position);
    let successful = false;

    if (target && this.isControlUsable(target)) {
      target.invokeDropData(this.toLocal(target, position), this.gui.dragData);
      successful = this.isControlValid(target);
    }
    this.endDragging(successful);
  }

  private findDropTarget (target: Control | null, position: Vector2): Control | null {
    let current: CanvasItem | null = target;

    while (current && this.isCanvasItemUsable(current)) {
      if (current instanceof Control) {
        const canDrop = current.invokeCanDropData(this.toLocal(current, position), this.gui.dragData);

        if (!this.isControlValid(current)) {
          return null;
        }
        if (canDrop) {
          return current;
        }
        if (current.getEffectiveMouseFilter() === MouseFilter.Stop) {
          return null;
        }
      }
      if (current.topLevel) {
        return null;
      }
      current = current.parent;
    }

    return null;
  }

  private endDragging (successful: boolean): void {
    this.gui.dragSuccessful = successful;
    this.gui.dragging = false;
    this.gui.globalDragging = false;
    this.gui.dragData = null;
    this.gui.dragMouseOver = null;
    this.gui.dragPreview = null;
  }

  private updateCursor (target: Control | null, position: Vector2): void {
    let current = target;
    let shape = CursorShape.Arrow;

    while (current && this.isControlUsable(current)) {
      const localPosition = this.toLocal(current, position);
      const candidate = this.gui.mouseFocusMask !== 0 || current.hasPoint(localPosition)
        ? current.getCursorShape(localPosition)
        : CursorShape.Arrow;

      if (!this.isControlValid(current)) {
        break;
      }
      if (candidate !== CursorShape.Arrow) {
        shape = candidate;

        break;
      }
      if (current.getEffectiveMouseFilter() === MouseFilter.Stop || current.topLevel) {
        break;
      }
      current = current.getParentControl();
    }
    this.engine.canvas.style.cursor = cursorNames[shape];
  }

  private buildHoverHierarchy (target: Control | null): Control[] {
    const hierarchy: Control[] = [];
    let current: CanvasItem | null = target;

    while (current && this.isCanvasItemUsable(current)) {
      if (current instanceof Control) {
        const filter = current.getEffectiveMouseFilter();

        if (filter !== MouseFilter.Ignore) {
          hierarchy.push(current);
        }
        if (filter === MouseFilter.Stop) {
          break;
        }
      }
      if (current.topLevel) {
        break;
      }
      current = current.parent;
    }
    hierarchy.reverse();

    return hierarchy;
  }

  private dropControlState (control: Control): void {
    if (this.gui.mouseFocus === control) {
      this.dropMouseFocus();
    }
    if (this.gui.mouseClickGrabber === control) {
      this.gui.mouseClickGrabber = null;
    }
    if (this.gui.keyFocus === control) {
      this.releaseFocus(control);
    }
    if (this.gui.dragMouseOver === control) {
      this.gui.dragMouseOver = null;
    }
    for (const [index, target] of this.gui.touchFocus) {
      if (target === control) {
        this.gui.touchFocus.delete(index);
      }
    }
  }

  private requestMouseOverUpdate (): void {
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;
    } else {
      this.updateMouseOver(this.gui.lastMousePosition);
    }
  }

  private sortRoots (): void {
    if (!this.gui.rootsOrderDirty) {
      return;
    }

    const registered = new Set(Array.from(this.rootControls).filter(control => this.isControlValid(control)));
    const sorted: Control[] = [];

    for (const composition of this.engine.compositions) {
      const layers = composition.canvasLayers.slice().sort((left, right) => left.layer - right.layer);

      for (const layer of layers) {
        for (const item of layer.canvasItems) {
          this.collectRootsInDrawOrder(item, registered, sorted);
        }
      }
    }
    this.gui.roots = sorted;
    this.gui.rootsOrderDirty = false;
  }

  private collectRootsInDrawOrder (item: CanvasItem, registered: Set<Control>, output: Control[]): void {
    if (!item.isActiveInCanvasTree()) {
      return;
    }
    if (item instanceof Control && registered.has(item)) {
      output.push(item);
    }
    for (const child of item.children) {
      if (!child.topLevel) {
        this.collectRootsInDrawOrder(child, registered, output);
      }
    }
  }

  private getGlobalInverse (control: Control): Matrix3 {
    const transform = control.getGlobalTransform2D().clone();

    if (Math.abs(transform.determinant()) < 1e-12) {
      return new Matrix3();
    }

    return transform.invert();
  }

  private toLocal (control: Control, position: Vector2): Vector2 {
    const transform = this.getGlobalInverse(control);
    const elements = transform.elements;

    return new Vector2(
      elements[0] * position.x + elements[3] * position.y + elements[6],
      elements[1] * position.x + elements[4] * position.y + elements[7],
    );
  }

  private isControlValid (control: Control | null): control is Control {
    return !!control && this.engine.objectInstance[control.getInstanceId()] === control && !!control.item;
  }

  private isCanvasItemValid (item: CanvasItem | null): item is CanvasItem {
    return !!item && this.engine.objectInstance[item.getInstanceId()] === item && !!item.item;
  }

  private isCanvasItemUsable (item: CanvasItem | null): item is CanvasItem {
    return this.isCanvasItemValid(item) && item.isActiveInCanvasTree() &&
      !!item.item.composition?.interactive;
  }

  private isControlUsable (control: Control | null): control is Control {
    return this.isControlValid(control) && control.isActiveInCanvasTree() &&
      !!control.item.composition?.interactive;
  }

  private isMouseTargetUsable (control: Control | null): control is Control {
    return this.isControlUsable(control) && control.enabled &&
      control.getEffectiveMouseFilter() !== MouseFilter.Ignore;
  }

  private isFocusTargetUsable (control: Control | null): control is Control {
    return this.isControlUsable(control) && control.enabled &&
      control.getFocusModeWithOverride() !== FocusMode.None;
  }

  private isInDragPreview (control: Control): boolean {
    const preview = this.gui.dragPreview;

    if (!this.isControlValid(preview)) {
      return false;
    }
    let current: CanvasItem | null = control;

    while (current) {
      if (current === preview) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }
}
