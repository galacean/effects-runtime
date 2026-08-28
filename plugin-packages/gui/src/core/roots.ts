import type { UICanvas } from '../components/ui-canvas';
import {
  InputEvent,
  InputEventKey,
  InputEventMouse,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  MouseButton,
  MouseButtonMask,
  math,
} from '@galacean/effects';
import type {
  Engine,
} from '@galacean/effects';
import {
  CursorShape,
  FocusMode,
  MouseBehaviorRecursive,
  MouseFilter,
} from './enums';
import type { CursorStyle } from './enums';
import type { Container } from './control';
import { Control, RootControl } from './control';
import type { Theme } from './theme';

type Matrix3 = math.Matrix3;
type Vector2 = math.Vector2;
const Matrix3 = math.Matrix3;
const Vector2 = math.Vector2;

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
  hideFocus: boolean,
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

type PopupState = {
  control: Control,
  restoreFocus: Control | null,
  restoreFocusHidden: boolean,
  originalTheme: Theme | null,
};

class PopupLayer extends Control {
  closeTop?: () => void;

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
    this.visible = false;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left || event.buttonIndex === MouseButton.Right) {
      this.closeTop?.();
      event.accept();
    }
  }
}

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
  private readonly popupLayer: PopupLayer;
  private readonly popupStack: PopupState[] = [];
  dragThreshold = 10;
  private lastInput: InputEvent | null = null;
  private readonly dirtyContainers = new Set<Container>();
  private readonly dirtyMeasurements = new Set<Control>();
  private readonly gui: GUIState = {
    mouseFocus: null,
    mouseClickGrabber: null,
    mouseFocusMask: MouseButtonMask.None,
    mouseOver: null,
    mouseOverHierarchy: [],
    touchFocus: new Map(),
    keyFocus: null,
    hideFocus: false,
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
    this.popupLayer = new PopupLayer(engine);
    this.popupLayer.setAnchorMax(1, 1);
    this.popupLayer.setOffsetMax(0, 0);
    this.popupLayer.closeTop = () => {
      const top = this.popupStack[this.popupStack.length - 1];

      if (top) {this.closePopupControl(top.control);}
    };
    this.popupLayer.parent = this;
  }

  pushInput (event: InputEvent): void {
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

  override guiControlHasFocus (control: Control, visibleOnly = false): boolean {
    return this.guiGetFocusOwner() === control && (!visibleOnly || !this.gui.hideFocus);
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

  override grabControlFocus (control: Control, hideFocus = false): void {
    if (!this.isFocusTargetUsable(control)) {
      return;
    }
    if (this.gui.keyFocus === control) {
      this.gui.hideFocus = hideFocus;

      return;
    }
    const previous = this.gui.keyFocus;

    this.gui.keyFocus = control;
    this.gui.hideFocus = hideFocus;
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
    this.gui.hideFocus = false;
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
    this.updateMouseOverHierarchy();
  }

  override controlRemoved (control: Control): void {
    this.dropControlState(control);
    this.cleanupInternalState();
    this.updateMouseOverHierarchy();
  }

  override controlTreeChanged (): void {
    this.updateMouseOverHierarchy();
  }

  override popupControl (control: Control, source: Control | null, position: Vector2): void {
    this.closePopupControl(control);
    const originalTheme = control.theme;
    const focusOwner = this.guiGetFocusOwner();
    const restoreFocus = source ?? focusOwner;
    const restoreFocusHidden = restoreFocus === focusOwner && !!restoreFocus && !restoreFocus.hasFocus(true);

    if (!originalTheme) {control.theme = source?.getInheritedTheme() ?? null;}
    const desired = control.getBoundDesiredSize();
    const width = Math.max(control.width, desired.x);
    const height = Math.max(control.height, desired.y);

    control.setSize(width, height);
    control.setPosition(
      Math.max(0, Math.min(position.x, this.width - width)),
      Math.max(0, Math.min(position.y, this.height - height)),
    );
    control.parent = this.popupLayer;
    control.visible = true;
    this.popupLayer.visible = true;
    this.popupStack.push({ control, restoreFocus, restoreFocusHidden, originalTheme });
    control.onPopupOpened();
    control.grabFocus();
  }

  override closePopupControl (control: Control): void {
    const index = this.popupStack.findIndex(state => state.control === control);

    if (index === -1) {return;}
    const removed = this.popupStack.splice(index);

    for (let removedIndex = removed.length - 1; removedIndex >= 0; removedIndex--) {
      const state = removed[removedIndex];

      state.control.visible = false;
      state.control.parent = null;
      state.control.theme = state.originalTheme;
      state.control.onPopupClosed();
    }
    this.popupLayer.visible = this.popupStack.length > 0;
    const { restoreFocus: restore, restoreFocusHidden } = removed[0];

    if (restore && !restore.isDisposed && restore.root === this) {restore.grabFocus(restoreFocusHidden);}
  }

  override queueLayout (container: Container): void {
    if (!container.isDisposed) {
      this.dirtyContainers.add(container);
    }
  }

  override queueMeasurementChange (control: Control): void {
    if (!control.isDisposed) {
      this.dirtyMeasurements.add(control);
    }
  }

  override cancelPointerInput (): void {
    this.dropMouseFocus();
    this.dropMouseOver();
    this.gui.touchFocus.clear();
    this.endDragging(false);
    this.releaseControlFocus();
  }

  onCanvasBlur (): void {
    const target = this.gui.mouseFocus;
    const mask = this.gui.mouseFocusMask;

    this.dropMouseFocus();
    if (!target || target.isDisposed) {
      return;
    }
    for (const button of [MouseButton.Left, MouseButton.Right, MouseButton.Middle]) {
      if ((mask & getButtonMask(button)) === 0) {
        continue;
      }
      const event = new InputEventMouseButton();
      const position = target.makePositionLocal(this.gui.lastMousePosition);

      event.device = InputEvent.deviceIdInternal;
      event.buttonIndex = button;
      event.pressed = false;
      event.position.copyFrom(position);
      event.globalPosition.copyFrom(position);
      this.callControlInput(target, event);
    }
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
    this.popupLayer.setSize(width, height);
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
      this.updateMouseOverHierarchy();
    }
    super.update(deltaTime);
    this.flushLayout();
  }

  override dispose (): void {
    this.cancelPointerInput();
    this.dirtyContainers.clear();
    this.dirtyMeasurements.clear();
    for (const state of this.popupStack.splice(0)) {
      state.control.parent = null;
      state.control.theme = state.originalTheme;
      state.control.onPopupClosed();
    }
    super.dispose();
  }

  private flushLayout (): void {
    let round = 0;

    while (this.dirtyMeasurements.size > 0 || this.dirtyContainers.size > 0) {
      if (round++ >= 32) {
        this.dirtyMeasurements.clear();
        this.dirtyContainers.clear();
        throw new Error('GUI layout did not converge after 32 rounds.');
      }
      if (this.dirtyMeasurements.size > 0) {
        const measurements = Array.from(this.dirtyMeasurements);

        this.dirtyMeasurements.clear();
        measurements.sort((left, right) => this.getControlDepth(right) - this.getControlDepth(left));
        for (const control of measurements) {
          if (control.root === this && !control.isDisposed) {
            control.invokeMeasurementChanges();
          }
        }
        continue;
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
        this.callGUIInput(target, event);
      }
    } else if (event instanceof InputEventMouse) {
      this.gui.lastMousePosition.copyFrom(event.globalPosition);
      const target = this.updateMouseOver(event.globalPosition);

      if (event instanceof InputEventMouseButton) {
        this.processMouseButton(event, target);
      } else if (event instanceof InputEventMouseMotion) {
        this.processMouseMotion(event, target);
      }
    } else if (event instanceof InputEventScreenTouch) {
      this.processScreenTouch(event);
    } else if (event instanceof InputEventScreenDrag) {
      this.processScreenDrag(event);
    }
  }

  private processMouseButton (event: InputEventMouseButton, mouseOver: Control | null): void {
    if (isWheelButton(event.buttonIndex)) {
      if (mouseOver) {
        this.callGUIInput(mouseOver, event);
      }

      return;
    }
    const mask = getButtonMask(event.buttonIndex);

    if (event.isPressed()) {
      const target = this.gui.mouseFocusMask !== 0
        ? this.gui.mouseFocus
        : mouseOver;

      this.gui.mouseFocus = target;
      if (!target) {
        if (event.buttonIndex === MouseButton.Left && this.gui.keyFocus) {
          this.gui.hideFocus = true;
        }

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

  private processMouseMotion (event: InputEventMouseMotion, mouseOver: Control | null): void {
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
      : mouseOver;

    if (target) {
      this.callGUIInput(target, event);
    }
    if (this.gui.dragging) {
      this.gui.dragMouseOver = this.findDropTarget(mouseOver, event.globalPosition);
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
    if (this.popupLayer.visible) {
      return this.findControlAtPosition(this.popupLayer, position) ?? this.popupLayer;
    }
    this.canvases.sortCanvases();

    return this.findControlAtPosition(this.canvases, position, true);
  }

  private findControlAtPosition (
    container: Control,
    positionInParent: Vector2,
    skipSelf = false,
    parentEnabled = true,
    parentMouseEnabled = true,
  ): Control | null {
    if (!container.visible || container.isDisposed ||
      (container instanceof CanvasRootControl && (!container.canvas.isVisible || container.inputDisabled))) {
      return null;
    }
    const localPosition = this.toControlLocal(container, positionInParent);

    if (!localPosition) {
      return null;
    }
    const enabled = parentEnabled && container.enabled;
    const mouseEnabled = container.mouseBehaviorRecursive === MouseBehaviorRecursive.Inherited
      ? parentMouseEnabled
      : container.mouseBehaviorRecursive === MouseBehaviorRecursive.Enabled;

    if (container.clipContents && !container.hasPoint(localPosition)) {
      return null;
    }
    for (let index = container.children.length - 1; index >= 0; index--) {
      const child = container.children[index];

      if (!container.intersectsChildContent(child, localPosition)) {
        continue;
      }
      const found = this.findControlAtPosition(child, localPosition, false, enabled, mouseEnabled);

      if (found) {
        return found;
      }
    }
    if (!skipSelf && enabled && mouseEnabled && container.mouseFilter !== MouseFilter.Ignore &&
      container.hasPoint(localPosition)) {
      return container;
    }

    return null;
  }

  private toControlLocal (control: Control, positionInParent: Vector2): Vector2 | null {
    const elements = control.getTransform2D().elements;
    const determinant = elements[0] * elements[4] - elements[1] * elements[3];

    if (Math.abs(determinant) < 1e-12) {
      return null;
    }
    const x = positionInParent.x - elements[6];
    const y = positionInParent.y - elements[7];

    return new Vector2(
      (elements[4] * x - elements[3] * y) / determinant,
      (elements[0] * y - elements[1] * x) / determinant,
    );
  }

  private updateMouseOver (position: Vector2): Control | null {
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;

      return this.gui.mouseOver;
    }
    this.gui.mouseOverUpdatePending = false;
    const target = this.findInputControl(position);
    const next = this.buildHoverHierarchy(target);

    this.applyMouseOver(target, next, position);

    return this.isControlUsable(target) ? target : null;
  }

  private updateMouseOverHierarchy (): void {
    const current = this.gui.mouseOver;

    if (!current || this.gui.mouseOverHierarchy.length === 0) {
      return;
    }
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;

      return;
    }
    if (!this.isControlUsable(current)) {
      this.dropMouseOver();

      return;
    }
    const next = this.buildHoverHierarchy(current);
    const target = current.getEffectiveMouseFilter() === MouseFilter.Ignore ? null : current;

    this.applyMouseOver(target, next, this.gui.lastMousePosition);
  }

  private applyMouseOver (target: Control | null, next: Control[], position: Vector2): void {
    const previous = this.gui.mouseOverHierarchy;
    let common = 0;

    while (common < previous.length && common < next.length && previous[common] === next[common]) {
      common++;
    }
    this.gui.mouseOver = target;
    this.gui.mouseOverHierarchy = next;
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
  }

  private buildHoverHierarchy (target: Control | null): Control[] {
    const hierarchy: Control[] = [];
    let current = target;

    while (current && current !== this) {
      const filter = current.getEffectiveMouseFilter();

      if (filter !== MouseFilter.Ignore) {
        hierarchy.push(current);
      }
      if (filter === MouseFilter.Stop) {
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
        this.grabControlFocus(current, true);

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
    if (this.gui.sendingMouseEnterExit) {
      this.gui.mouseOverUpdatePending = true;

      return;
    }
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
