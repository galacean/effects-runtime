import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Composition } from '../../composition';
import type { Engine } from '../../engine';
import { EventEmitter } from '../../events';
import {
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  KeyLocation,
  MouseButton,
  MouseButtonMask,
} from '../../input';
import type { Disposable } from '../../utils';
import { addItem, removeItem } from '../../utils';
import { PointerEventData, type Region } from './click-handler';

export const EVENT_TYPE_CLICK = 'click';
export const EVENT_TYPE_TOUCH_START = 'touchstart';
export const EVENT_TYPE_TOUCH_MOVE = 'touchmove';
export const EVENT_TYPE_TOUCH_END = 'touchend';

export type TouchEventType = {
  x: number,
  y: number,
  vx: number,
  vy: number,
  ts: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
  origin: Event,
};

export type TouchParams = {
  clientX: number,
  clientY: number,
  target: EventTarget,
};

export enum PointerEventType {
  PointerDown,
  PointerUp,
  PointerMove
}

type PointerState = {
  start: Vector2,
  last: Vector2,
  lastTime: number,
  inputHandled: boolean,
  pressed: boolean,
};

type NativeHandler = {
  target: EventTarget,
  name: string,
  handler: EventListener,
  options?: AddEventListenerOptions | boolean,
};

export type EventSystemEvent = {
  input: [event: InputEvent],
  onCanvasFocus: [],
  onCanvasBlur: [],
};

export class EventSystem extends EventEmitter<EventSystemEvent> implements Disposable {
  skipPointerMovePicking = true;
  private readonly emulateMouseFromTouch = true;
  private readonly emulateTouchFromMouse = false;

  private _enabled = true;
  private handlers: Record<string, ((event: TouchEventType) => void)[]> = {};
  private nativeHandlers: NativeHandler[] = [];
  private target: HTMLCanvasElement | null = null;
  private mouseState: PointerState | null = null;
  /**
   * Logical mouse button state maintained from mousedown/mouseup transitions.
   *
   * On macOS, a trackpad may emit a release-edge pointermove with buttons=0
   * before mouseup. Treating that motion as a release ends the drag early and
   * may skip the final transform commit.
   */
  private mouseButtonMask = MouseButtonMask.None;
  private touchStates = new Map<number, PointerState>();
  private mouseFromTouchIndex: number | null = null;
  private touchFromMousePressed = false;
  private addedTabIndex = false;
  private addedOutlineStyle = false;

  constructor (
    public engine: Engine,
    public allowPropagation = false,
  ) {
    super();
  }

  get enabled (): boolean {
    return this._enabled;
  }

  /**
   * Enables native input processing.
   *
   * Change this only while there are no active key, mouse, touch, or drag sessions.
   */
  set enabled (value: boolean) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
  }

  /**
   * Rebinds native input listeners to a canvas.
   *
   * Rebind or unbind only while there are no active key, mouse, touch, or drag sessions.
   */
  bindListeners (target: HTMLCanvasElement | null): void {
    this.unbindListeners();
    this.target = target;
    if (!target || typeof window === 'undefined') {
      return;
    }
    if (!target.hasAttribute('tabindex')) {
      target.tabIndex = 0;
      this.addedTabIndex = true;
    }
    if (!target.style.outline) {
      target.style.outline = 'none';
      this.addedOutlineStyle = true;
    }

    this.addNativeHandler(target, 'mousedown', this.onNativeMouseDown as EventListener);
    // The Window listener runs after the event reaches the host container, so keep a
    // target listener to preserve notifyTouch/allowPropagation for in-canvas releases.
    this.addNativeHandler(target, 'mouseup', this.onNativeMouseUp as EventListener);
    this.addNativeHandler(window, 'mouseup', this.onNativeMouseUp as EventListener);
    this.addNativeHandler(window, 'pointermove', this.onNativeMouseMove as EventListener);
    this.addNativeHandler(target, 'touchstart', this.onNativeTouchStart as EventListener, { passive: false });
    this.addNativeHandler(target, 'touchmove', this.onNativeTouchMove as EventListener, { passive: false });
    this.addNativeHandler(target, 'touchend', this.onNativeTouchEnd as EventListener, { passive: false });
    this.addNativeHandler(target, 'touchcancel', this.onNativeTouchCancel as EventListener, { passive: false });
    this.addNativeHandler(target, 'wheel', this.onNativeWheel as EventListener, { passive: false });
    this.addNativeHandler(target, 'keydown', this.onNativeKeyDown as EventListener);
    this.addNativeHandler(target, 'keyup', this.onNativeKeyUp as EventListener);
    this.addNativeHandler(target, 'focus', this.onCanvasFocus as EventListener);
    this.addNativeHandler(target, 'blur', this.onCanvasBlur as EventListener);
  }

  dispatchEvent (type: string, event: TouchEventType): void {
    const handlers = this.handlers[type];

    handlers?.slice().forEach(fn => fn(event));
    if (type === EVENT_TYPE_CLICK) {
      this.onClick(event);
    } else if (type === EVENT_TYPE_TOUCH_START) {
      this.onPointerDown(event);
    } else if (type === EVENT_TYPE_TOUCH_END) {
      this.onPointerUp(event);
    } else if (type === EVENT_TYPE_TOUCH_MOVE) {
      this.onPointerMove(event);
    }
  }

  addEventListener (type: string, callback: (event: TouchEventType) => void): () => void {
    let handlers = this.handlers[type];

    if (!handlers) {
      handlers = this.handlers[type] = [];
    }
    addItem(handlers, callback);

    return () => {
      removeItem(handlers, callback);
    };
  }

  removeEventListener (type: string, callback: (event: TouchEventType) => void): void {
    const handlers = this.handlers[type];

    if (handlers) {
      removeItem(handlers, callback);
    }
  }

  dispose (): void {
    this.resetInputState();
    this.handlers = {};
    this.unbindListeners();
    this.target = null;
  }

  private onNativeWheel = (event: WheelEvent): void => {
    if (!this.enabled || !this.target) {
      return;
    }
    const position = this.getCanvasPosition(event.clientX, event.clientY);
    let handled = false;

    if (event.deltaY !== 0) {
      handled = this.pushWheelButton(
        event.deltaY < 0 ? MouseButton.WheelUp : MouseButton.WheelDown,
        normalizeWheelFactor(event.deltaY, event.deltaMode), position, event,
      ) || handled;
    }
    if (event.deltaX !== 0) {
      handled = this.pushWheelButton(
        event.deltaX < 0 ? MouseButton.WheelLeft : MouseButton.WheelRight,
        normalizeWheelFactor(event.deltaX, event.deltaMode), position, event,
      ) || handled;
    }
    this.consumeNativeEvent(event, handled);
  };

  private onNativeKeyDown = (event: KeyboardEvent): void => {
    this.handleNativeKey(event, true);
  };

  private onNativeKeyUp = (event: KeyboardEvent): void => {
    this.handleNativeKey(event, false);
  };

  private onNativeMouseDown = (event: MouseEvent): void => {
    this.handleNativeMouseDown(event);
  };

  private onNativeMouseMove = (event: MouseEvent): void => {
    if (!this.enabled || !this.target) {
      return;
    }
    const position = this.getCanvasPosition(event.clientX, event.clientY);
    const state = this.mouseState ?? this.createPointerState(position);

    this.mouseState = state;
    const relative = new Vector2(position.x - state.last.x, position.y - state.last.y);
    const velocity = this.getVelocity(state, position);
    const handled = this.pushNativeMouseMotion(event, position, relative, velocity);

    state.inputHandled ||= handled;
    if (!handled && (!state.pressed || !state.inputHandled)) {
      const pointerEvent = this.createPointerEvent(event, position, state, velocity);

      this.dispatchEvent(EVENT_TYPE_TOUCH_MOVE, pointerEvent);
    }
    this.updatePointerState(state, position);
    this.consumeNativeEvent(event, handled);
  };

  private onNativeMouseUp = (event: MouseEvent): void => {
    if (!this.enabled || !this.target) {
      return;
    }
    // Keep the canonical mask in sync even when mouseState already ended on a
    // previous button release. The target and Window listeners may see the
    // same mouseup, but clearing a bit twice is intentionally idempotent.
    this.setMouseButtonPressed(event.button, false);
    const position = this.getCanvasPosition(event.clientX, event.clientY);
    const existingState = this.mouseState;

    if (!existingState?.pressed) {
      return;
    }
    const state = existingState;
    const handled = this.pushNativeMouseButton(event, position, false);
    const pointerEvent = this.createPointerEvent(event, position, state);

    if (!state.inputHandled && !handled && this.isClick(state, position)) {
      this.dispatchEvent(EVENT_TYPE_CLICK, pointerEvent);
    }
    if (!handled && !state.inputHandled) {
      this.dispatchEvent(EVENT_TYPE_TOUCH_END, pointerEvent);
    }
    this.mouseState = null;
    this.consumeNativeEvent(event, handled || state.inputHandled || !this.allowPropagation);
  };

  private onNativeTouchStart = (event: TouchEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.focusTarget();
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state = this.createPointerState(position);

      this.touchStates.set(touch.identifier, state);
      state.pressed = true;
      const handled = this.pushNativeScreenTouch(touch.identifier, position, true, false, false);

      state.inputHandled = handled;
      if (!handled) {
        const pointerEvent = this.createPointerEvent(event, position, state);

        this.dispatchEvent(EVENT_TYPE_TOUCH_START, pointerEvent);
      }
      this.consumeNativeEvent(event, handled);
    }
    this.preventTouchDefaults(event);
  };

  private onNativeTouchMove = (event: TouchEvent): void => {
    if (!this.enabled) {
      return;
    }
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state = this.touchStates.get(touch.identifier) ?? this.createPointerState(position);

      this.touchStates.set(touch.identifier, state);
      const relative = new Vector2(position.x - state.last.x, position.y - state.last.y);
      const velocity = this.getVelocity(state, position);
      const handled = this.pushNativeScreenDrag(touch.identifier, position, relative, velocity);

      state.inputHandled ||= handled;
      if (!handled && !state.inputHandled) {
        const pointerEvent = this.createPointerEvent(event, position, state, velocity);

        this.dispatchEvent(EVENT_TYPE_TOUCH_MOVE, pointerEvent);
      }
      this.updatePointerState(state, position);
      this.consumeNativeEvent(event, handled);
    }
    this.preventTouchDefaults(event);
  };

  private onNativeTouchEnd = (event: TouchEvent): void => {
    this.handleNativeTouchEnd(event, false);
  };

  private onNativeTouchCancel = (event: TouchEvent): void => {
    this.handleNativeTouchEnd(event, true);
  };

  private onCanvasFocus = (): void => {
    this.emit('onCanvasFocus');
  };

  private onCanvasBlur = (): void => {
    this.emit('onCanvasBlur');
  };

  private handleNativeMouseDown (event: MouseEvent): void {
    if (!this.enabled || !this.target) {
      return;
    }
    this.setMouseButtonPressed(event.button, true);
    const position = this.getCanvasPosition(event.clientX, event.clientY);

    this.focusTarget();
    const state = this.createPointerState(position);

    this.mouseState = state;
    state.pressed = true;
    const handled = this.pushNativeMouseButton(event, position, true);

    state.inputHandled = handled;
    if (!handled) {
      const pointerEvent = this.createPointerEvent(event, position, state);

      this.dispatchEvent(EVENT_TYPE_TOUCH_START, pointerEvent);
    }
    this.consumeNativeEvent(event, handled);
  }

  private handleNativeKey (event: KeyboardEvent, pressed: boolean): void {
    if (!this.enabled) {
      return;
    }
    const input = new InputEventKey();

    input.device = InputEvent.deviceIdKeyboard;
    input.pressed = pressed;
    input.echo = pressed && event.repeat;
    input.keycode = event.key;
    input.physicalKeycode = event.code;
    input.keyLabel = event.key;
    input.unicode = getUnicode(event.key);
    input.location = getKeyLocation(event.location);
    input.shiftPressed = event.shiftKey;
    input.altPressed = event.altKey;
    input.metaPressed = event.metaKey;
    input.ctrlPressed = event.ctrlKey;
    this.consumeNativeEvent(event, this.pushInput(input));
  }

  private handleNativeTouchEnd (event: TouchEvent, canceled: boolean): void {
    if (!this.enabled) {
      return;
    }
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state = this.touchStates.get(touch.identifier);

      if (!state?.pressed) {
        continue;
      }
      const handled = this.pushNativeScreenTouch(touch.identifier, position, false, canceled, false);
      const pointerEvent = this.createPointerEvent(event, position, state);

      if (!canceled && !state.inputHandled && !handled && this.isClick(state, position)) {
        this.dispatchEvent(EVENT_TYPE_CLICK, pointerEvent);
      }
      if (!handled && !canceled && !state.inputHandled) {
        this.dispatchEvent(EVENT_TYPE_TOUCH_END, pointerEvent);
      }
      this.touchStates.delete(touch.identifier);
      this.consumeNativeEvent(event, handled || state.inputHandled || !this.allowPropagation);
    }
    this.preventTouchDefaults(event);
  }

  private pushNativeMouseButton (event: MouseEvent, position: Vector2, pressed: boolean): boolean {
    let handled = false;
    const button = getMouseButton(event.button);

    if (pressed && this.emulateTouchFromMouse && button === MouseButton.Left) {
      this.touchFromMousePressed = true;
    }
    if (this.touchFromMousePressed && button === MouseButton.Left) {
      handled = this.pushScreenTouch(
        0,
        position,
        pressed,
        false,
        event.detail > 1,
        InputEvent.deviceIdEmulation,
      );
      if (!pressed) {
        this.touchFromMousePressed = false;
      }
    }

    return this.pushMouseButton(event, position, pressed) || handled;
  }

  private pushNativeMouseMotion (
    event: MouseEvent,
    position: Vector2,
    relative: Vector2,
    velocity: Vector2,
  ): boolean {
    let handled = false;

    if (this.touchFromMousePressed && (this.mouseButtonMask & MouseButtonMask.Left) !== 0) {
      handled = this.pushScreenDrag(
        0,
        position,
        relative,
        velocity,
        InputEvent.deviceIdEmulation,
      );
    }

    return this.pushMouseMotion(event, position, relative, velocity) || handled;
  }

  private pushNativeScreenTouch (
    index: number,
    position: Vector2,
    pressed: boolean,
    canceled: boolean,
    doubleTap: boolean,
  ): boolean {
    let handled = false;
    let emulateMouse = false;

    if (pressed && this.emulateMouseFromTouch && this.mouseFromTouchIndex === null) {
      this.mouseFromTouchIndex = index;
      emulateMouse = true;
    } else if (!pressed && this.mouseFromTouchIndex === index) {
      emulateMouse = true;
      this.mouseFromTouchIndex = null;
    }
    if (emulateMouse) {
      handled = this.pushEmulatedMouseButton(position, pressed, canceled, doubleTap);
    }

    return this.pushScreenTouch(index, position, pressed, canceled, doubleTap, 0) || handled;
  }

  private pushNativeScreenDrag (
    index: number,
    position: Vector2,
    relative: Vector2,
    velocity: Vector2,
  ): boolean {
    let handled = false;

    if (this.emulateMouseFromTouch && this.mouseFromTouchIndex === index) {
      handled = this.pushEmulatedMouseMotion(position, relative, velocity);
    }

    return this.pushScreenDrag(index, position, relative, velocity, 0) || handled;
  }

  private pushEmulatedMouseButton (
    position: Vector2,
    pressed: boolean,
    canceled: boolean,
    doubleClick: boolean,
  ): boolean {
    const input = new InputEventMouseButton();

    input.device = InputEvent.deviceIdEmulation;
    input.position.copyFrom(position);
    input.globalPosition.copyFrom(position);
    input.buttonIndex = MouseButton.Left;
    input.buttonMask = pressed ? MouseButtonMask.Left : MouseButtonMask.None;
    input.pressed = pressed;
    input.canceled = canceled;
    input.doubleClick = doubleClick;

    return this.pushInput(input);
  }

  private pushEmulatedMouseMotion (
    position: Vector2,
    relative: Vector2,
    velocity: Vector2,
  ): boolean {
    const input = new InputEventMouseMotion();

    input.device = InputEvent.deviceIdEmulation;
    input.position.copyFrom(position);
    input.globalPosition.copyFrom(position);
    input.buttonMask = MouseButtonMask.Left;
    input.pressed = true;
    input.relative.copyFrom(relative);
    input.screenRelative.copyFrom(relative);
    input.velocity.copyFrom(velocity);
    input.screenVelocity.copyFrom(velocity);

    return this.pushInput(input);
  }

  private pushMouseButton (
    event: MouseEvent | PointerEvent,
    position: Vector2,
    pressed: boolean,
  ): boolean {
    const input = new InputEventMouseButton();

    this.copyMouseFields(input, event, position);
    input.device = InputEvent.deviceIdMouse;
    input.buttonIndex = getMouseButton(event.button);
    input.buttonMask = this.mouseButtonMask;
    input.pressed = pressed;
    input.doubleClick = event.detail > 1;

    return this.pushInput(input);
  }

  private setMouseButtonPressed (button: number, pressed: boolean): void {
    const buttonBit = getMouseButtonBit(getMouseButton(button));

    if (pressed) {
      this.mouseButtonMask |= buttonBit;
    } else {
      this.mouseButtonMask &= ~buttonBit;
    }
  }

  private pushWheelButton (
    button: MouseButton,
    factor: number,
    position: Vector2,
    event: WheelEvent,
  ): boolean {
    const input = new InputEventMouseButton();

    this.copyMouseFields(input, event, position);
    input.device = InputEvent.deviceIdMouse;
    input.buttonIndex = button;
    input.buttonMask = this.mouseButtonMask;
    input.factor = factor;
    input.pressed = true;

    return this.pushInput(input);
  }

  private pushMouseMotion (
    event: MouseEvent | PointerEvent,
    position: Vector2,
    relative: Vector2,
    velocity: Vector2,
  ): boolean {
    const input = new InputEventMouseMotion();

    this.copyMouseFields(input, event, position);
    input.device = InputEvent.deviceIdMouse;
    input.buttonMask = this.mouseButtonMask;
    input.pressed = this.mouseButtonMask !== MouseButtonMask.None;
    input.relative.copyFrom(relative);
    input.screenRelative.copyFrom(relative);
    input.velocity.copyFrom(velocity);
    input.screenVelocity.copyFrom(velocity);
    if ('pressure' in event) {
      input.pressure = event.pressure;
      input.tilt.set(event.tiltX, event.tiltY);
    }

    return this.pushInput(input);
  }

  private pushScreenTouch (
    index: number,
    position: Vector2,
    pressed: boolean,
    canceled: boolean,
    doubleTap: boolean,
    device: number,
  ): boolean {
    const input = new InputEventScreenTouch();

    input.index = index;
    input.device = device;
    input.position.copyFrom(position);
    input.pressed = pressed;
    input.canceled = canceled;
    input.doubleTap = doubleTap;

    return this.pushInput(input);
  }

  private pushScreenDrag (
    index: number,
    position: Vector2,
    relative: Vector2,
    velocity: Vector2,
    device: number,
  ): boolean {
    const input = new InputEventScreenDrag();

    input.index = index;
    input.device = device;
    input.position.copyFrom(position);
    input.relative.copyFrom(relative);
    input.screenRelative.copyFrom(relative);
    input.velocity.copyFrom(velocity);
    input.screenVelocity.copyFrom(velocity);
    input.pressed = true;

    return this.pushInput(input);
  }

  private copyMouseFields (
    input: InputEventMouseButton | InputEventMouseMotion,
    event: MouseEvent | PointerEvent | WheelEvent,
    position: Vector2,
  ): void {
    input.position.copyFrom(position);
    input.globalPosition.copyFrom(position);
    input.shiftPressed = event.shiftKey;
    input.altPressed = event.altKey;
    input.metaPressed = event.metaKey;
    input.ctrlPressed = event.ctrlKey;
  }

  private onClick (event: TouchEventType): void {
    const hitResults: Region[] = [];

    for (const composition of this.engine.compositions) {
      hitResults.push(...composition.hitTest(event.x, event.y));
    }

    for (const hitResult of hitResults) {
      const hitComposition = hitResult.item.composition;

      if (!hitComposition) {
        continue;
      }
      const clickInfo = {
        ...hitResult,
        compositionId: hitComposition.id,
        compositionName: hitComposition.name,
      };

      hitResult.item.emit('click', hitResult);
      hitComposition.emit('click', clickInfo);
      this.engine.emit('click', clickInfo);
    }
  }

  private onPointerDown (event: TouchEventType): void {
    this.handlePointerEvent(event, PointerEventType.PointerDown);
  }

  private onPointerUp (event: TouchEventType): void {
    this.handlePointerEvent(event, PointerEventType.PointerUp);
  }

  private onPointerMove (event: TouchEventType): void {
    this.handlePointerEvent(event, PointerEventType.PointerMove);
  }

  private handlePointerEvent (event: TouchEventType, type: PointerEventType): void {
    let hitRegion: Region | null = null;

    if (!(type === PointerEventType.PointerMove && this.skipPointerMovePicking)) {
      for (const composition of this.engine.compositions) {
        const regions = composition.hitTest(event.x, event.y);

        if (regions.length > 0) {
          hitRegion = regions[regions.length - 1];
        }
      }
    }

    const eventData = new PointerEventData();

    eventData.position.x = (event.x + 1) / 2 * event.width;
    eventData.position.y = (event.y + 1) / 2 * event.height;
    eventData.delta.x = event.vx * event.width;
    eventData.delta.y = event.vy * event.height;

    if (hitRegion) {
      eventData.pointerCurrentRaycast.point = hitRegion.position;
      eventData.pointerCurrentRaycast.item = hitRegion.item;
    }

    const eventName = type === PointerEventType.PointerDown
      ? 'pointerdown'
      : type === PointerEventType.PointerUp ? 'pointerup' : 'pointermove';

    if (hitRegion) {
      const hitItem = hitRegion.item;
      const hitComposition = hitItem.composition as Composition;

      hitItem.emit(eventName, eventData);
      hitComposition.emit(eventName, eventData);
      this.engine.emit(eventName, eventData);
    }
  }

  private createPointerState (position: Vector2): PointerState {
    const state = {
      start: position.clone(),
      last: position.clone(),
      lastTime: performance.now(),
      inputHandled: false,
      pressed: false,
    };

    return state;
  }

  private updatePointerState (state: PointerState, position: Vector2): void {
    state.last.copyFrom(position);
    state.lastTime = performance.now();
  }

  private getVelocity (state: PointerState, position: Vector2): Vector2 {
    const elapsed = Math.max(performance.now() - state.lastTime, 1);

    return new Vector2(
      (position.x - state.last.x) / elapsed,
      (position.y - state.last.y) / elapsed,
    );
  }

  private isClick (state: PointerState, position: Vector2): boolean {
    return Math.abs(position.x - state.start.x) + Math.abs(position.y - state.start.y) < 4;
  }

  private createPointerEvent (
    origin: Event,
    position: Vector2,
    state: PointerState,
    velocity = new Vector2(),
  ): TouchEventType {
    const target = this.target;
    const rect = target?.getBoundingClientRect();
    const cssWidth = rect?.width || 1;
    const cssHeight = rect?.height || 1;

    return {
      x: position.x / cssWidth * 2 - 1,
      // Legacy composition picking uses bottom-left, Y-up NDC even though
      // standardized input follows the DOM convention of top-left, Y-down pixels.
      y: 1 - position.y / cssHeight * 2,
      vx: velocity.x / cssWidth * 2,
      vy: -velocity.y / cssHeight * 2,
      ts: performance.now(),
      dx: (position.x - state.start.x) / cssWidth * 2,
      dy: -(position.y - state.start.y) / cssHeight * 2,
      width: target?.width ?? 0,
      height: target?.height ?? 0,
      origin,
    };
  }

  private getCanvasPosition (clientX: number, clientY: number): Vector2 {
    const rect = this.target?.getBoundingClientRect();

    if (!rect) {
      return new Vector2();
    }

    return new Vector2(clientX - rect.left, clientY - rect.top);
  }

  private consumeNativeEvent (event: Event, handled: boolean): void {
    if (handled && !this.allowPropagation) {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
    }
  }

  private pushInput (input: InputEvent): boolean {
    input.clearAccepted();
    this.emit('input', input);

    return input.isAccepted();
  }

  private preventTouchDefaults (event: TouchEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  private focusTarget (): void {
    this.target?.focus();
  }

  private resetInputState (): void {
    this.mouseState = null;
    this.mouseButtonMask = MouseButtonMask.None;
    this.touchStates.clear();
    this.mouseFromTouchIndex = null;
    this.touchFromMousePressed = false;
  }

  private addNativeHandler (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(name, handler, options);
    this.nativeHandlers.push({ target, name, handler, options });
  }

  private unbindListeners (): void {
    for (const nativeHandler of this.nativeHandlers) {
      nativeHandler.target.removeEventListener(
        nativeHandler.name,
        nativeHandler.handler,
        nativeHandler.options,
      );
    }
    this.nativeHandlers = [];
    if (this.addedTabIndex && this.target) {
      this.target.removeAttribute('tabindex');
    }
    if (this.addedOutlineStyle && this.target) {
      this.target.style.removeProperty('outline');
    }
    this.addedTabIndex = false;
    this.addedOutlineStyle = false;
  }
}

function getKeyLocation (location: number): KeyLocation {
  if (location === 1) {
    return KeyLocation.Left;
  }
  if (location === 2) {
    return KeyLocation.Right;
  }

  return KeyLocation.Unspecified;
}

function getUnicode (key: string): number {
  const characters = Array.from(key);

  return characters.length === 1 ? characters[0].codePointAt(0) ?? 0 : 0;
}

function getMouseButton (button: number): MouseButton {
  switch (button) {
    case 0:
      return MouseButton.Left;
    case 1:
      return MouseButton.Middle;
    case 2:
      return MouseButton.Right;
    case 3:
      return MouseButton.Xbutton1;
    case 4:
      return MouseButton.Xbutton2;
    default:
      return MouseButton.None;
  }
}

function getMouseButtonBit (button: MouseButton): MouseButtonMask {
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

function normalizeWheelFactor (delta: number, mode: number): number {
  const magnitude = Math.abs(delta);

  if (mode === 1) {
    return magnitude / 3;
  }
  if (mode === 2) {
    return magnitude;
  }

  return magnitude / 100;
}
