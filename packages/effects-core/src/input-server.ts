import { effectsClass } from './decorators';
import { EngineServer } from './engine-server';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Composition } from './composition';
import type { Engine } from './engine';
import { EventEmitter } from './events';
import type { InputEventMouse } from './input';
import {
  InputEvent,
  InputEventFocus,
  InputEventKey,
  InputEventMouseBoundary,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  FocusEventType,
  KeyLocation,
  MouseButton,
  MouseButtonMask,
} from './input';
import type { Disposable } from './utils';
import { addItem, removeItem } from './utils';
import { PointerEventData, type Region } from './plugins/interact/click-handler';

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

type CompositionInteractionState = {
  start: Vector2,
  inputHandled: boolean,
};

type MouseInputState = {
  initiatingButton: MouseButton,
  buttonMask: MouseButtonMask,
  lastInput: InputEventMouse,
  lastTime: number,
};

type TouchInputState = {
  position: Vector2,
  lastTime: number,
  interaction: CompositionInteractionState,
};

type NativeHandler = {
  target: EventTarget,
  name: string,
  handler: EventListener,
  options?: AddEventListenerOptions | boolean,
};

export type InputServerEvent = {
  input: [event: InputEvent],
};

/** Engine-owned input, including native events and composition interaction. */
@effectsClass('InputServer')
export class InputServer extends EngineServer implements Disposable {
  private readonly events = new EventEmitter<InputServerEvent>();
  readonly on = this.events.on;
  readonly off = this.events.off;
  readonly once = this.events.once;
  readonly emit = this.events.emit;
  readonly getListeners = this.events.getListeners;
  allowPropagation: boolean;
  skipPointerMovePicking = true;
  private readonly emulateMouseFromTouch = true;

  private _enabled = true;
  private handlers: Record<string, ((event: TouchEventType) => void)[]> = {};
  private nativeHandlers: NativeHandler[] = [];
  private target: HTMLCanvasElement | null = null;
  private usePointerEvents = false;
  private hadFocus = false;
  private viewFocused = false;
  private windowFocused = true;
  private readonly pressedKeys = new Map<string, InputEventKey>();
  private mouseState: MouseInputState | null = null;
  private mouseInteraction: CompositionInteractionState | null = null;
  private nativePointerButton = MouseButton.None;
  private pointerClickTime = 0;
  private pointerClickCount = 0;
  private readonly pointerClickPosition = new Vector2();
  private touchStates = new Map<number, TouchInputState>();
  private mouseFromTouchIndex: number | null = null;
  private addedTabIndex = false;
  private addedOutlineStyle = false;

  constructor (engine: Engine) {
    super(engine, -1000);
    this.allowPropagation = engine.options.notifyTouch ?? false;
    this.enabled = engine.options.interactive ?? false;
  }

  override onInit (): void {
    this.bindListeners(this.engine.canvas);
  }

  override onBeforeExit (): void {
    this.bindListeners(null);
  }

  override onDispose (): void {
    this.dispose();
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
    // Mini-program canvas adapters support input events but may not implement
    // the full HTMLElement attribute and CSSStyleDeclaration APIs.
    if (
      typeof target.hasAttribute === 'function' &&
      typeof target.removeAttribute === 'function' &&
      !target.hasAttribute('tabindex')
    ) {
      target.tabIndex = 0;
      this.addedTabIndex = true;
    }
    if (typeof target.style?.removeProperty === 'function' && !target.style.outline) {
      target.style.outline = 'none';
      this.addedOutlineStyle = true;
    }

    this.usePointerEvents = typeof PointerEvent === 'function';
    const ownerDocument = target.ownerDocument ?? (typeof document === 'undefined' ? null : document);
    const continuationTarget = ownerDocument && typeof ownerDocument.addEventListener === 'function' ? ownerDocument : target;

    this.addNativeHandler(target, this.usePointerEvents ? 'pointerdown' : 'mousedown', this.onNativePointerDown as EventListener);
    this.addNativeHandler(continuationTarget, this.usePointerEvents ? 'pointerenter' : 'mouseenter', this.onNativePointerEnter as EventListener);
    this.addNativeHandler(continuationTarget, this.usePointerEvents ? 'pointermove' : 'mousemove', this.onNativePointingMove as EventListener, true);
    this.addNativeHandler(target, this.usePointerEvents ? 'pointerleave' : 'mouseout', this.onNativePointerLeave as EventListener);
    this.addNativeHandler(continuationTarget, this.usePointerEvents ? 'pointerup' : 'mouseup', this.onNativePointerUp as EventListener, true);
    // Touch is a separate desktop source. Touch PointerEvents never enter
    // the mouse/widget projection, and document continuations require a
    // touch session that started on this canvas.
    this.addNativeHandler(target, 'touchstart', this.onNativeTouchStart as EventListener, { passive: false });
    this.addNativeHandler(continuationTarget, 'touchmove', this.onNativeTouchMove as EventListener, { passive: false });
    this.addNativeHandler(continuationTarget, 'touchend', this.onNativeTouchEnd as EventListener, { passive: false });
    this.addNativeHandler(continuationTarget, 'touchcancel', this.onNativeTouchCancel as EventListener);
    this.addNativeHandler(continuationTarget, 'wheel', this.onNativeWheel as EventListener, { passive: false });
    this.addNativeHandler(continuationTarget, 'keydown', this.onNativeKeyDown as EventListener, true);
    this.addNativeHandler(continuationTarget, 'keyup', this.onNativeKeyUp as EventListener, true);
    this.addNativeHandler(window, 'focus', this.onWindowFocus as EventListener);
    this.addNativeHandler(window, 'blur', this.onWindowBlur as EventListener);
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
    if (!this.enabled || !this.target || !this.ownsNativeMouseEvent(event)) {
      return;
    }
    const position = this.getNativeMousePosition(event);
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
    this.preventAcceptedDefault(event, handled);
  };

  private onNativeKeyDown = (event: KeyboardEvent): void => {
    if (!this.ownsNativeEvent(event)) { return; }
    this.handleNativeKey(event, true);
  };

  private onNativeKeyUp = (event: KeyboardEvent): void => {
    if (!this.ownsNativeEvent(event) && !this.pressedKeys.has(event.code)) { return; }
    this.handleNativeKey(event, false);
  };

  private readonly onNativePointerDown = (event: MouseEvent): void => {
    if (!this.enabled || !this.target || this.isTouchPointer(event)) { return; }
    const position = this.getNativeMousePosition(event);

    this.nativePointerButton = getMouseButton(event.button);
    this.focusTarget();
    this.countPointerClick(event);
    if (this.isMouseButtonPressed()) {
      this.mouseState!.buttonMask = getNativeMouseButtonMask(event.buttons) | getMouseButtonBit(this.nativePointerButton);
      this.preventAcceptedDefault(event, this.pushNativePointerMotion(event, this.nativePointerButton, position));

      return;
    }
    const interaction = this.createCompositionInteraction(position);

    this.mouseInteraction = interaction;
    const handled = this.pushNativePointerButton(event, position, true);

    interaction.inputHandled = handled;
    if (!interaction.inputHandled) {
      this.dispatchEvent(EVENT_TYPE_TOUCH_START, this.createPointerEvent(event, position, interaction));
    }
    this.preventAcceptedDefault(event, interaction.inputHandled);
  };

  private readonly onNativePointerUp = (event: MouseEvent): void => {
    if (!this.enabled || !this.target || this.isTouchPointer(event) || !this.ownsNativeMouseEvent(event)) { return; }
    this.preventAcceptedDefault(event, this.releaseNativePointer(event));
  };

  private readonly onNativePointerEnter = (event: MouseEvent): void => {
    if (!this.enabled || !this.target || this.isTouchPointer(event)) { return; }
    const button = this.nativePointerButton;

    // Recover a missed middle/right release when the pointer re-enters Chrome.
    if (navigator.userAgent.includes('Chrome/') && this.isMouseButtonPressed() &&
      (button === MouseButton.Middle || button === MouseButton.Right) && !(getNativeMouseButtonMask(event.buttons) & getMouseButtonBit(button))) {
      this.preventAcceptedDefault(event, this.releaseNativePointer(event, button));
    }
    this.pushMouseBoundary(event, true);
  };

  private readonly onNativePointerLeave = (event: MouseEvent): void => {
    if (!this.enabled || this.isTouchPointer(event)) { return; }
    this.pushMouseBoundary(event, false);
  };

  private pushMouseBoundary (event: MouseEvent, entered: boolean): void {
    if (entered || this.isMouseButtonPressed()) {
      this.preventAcceptedDefault(event, this.pushNativePointerMotion(event, MouseButton.None));

      return;
    }
    const input = new InputEventMouseBoundary(entered);

    this.copyMouseFields(input, event, this.getNativeMousePosition(event));
    input.device = InputEvent.deviceIdMouse;
    this.mouseInteraction ??= this.createCompositionInteraction(input.position);
    this.preventAcceptedDefault(event, this.pushInput(input));
  }

  private releaseNativePointer (event: MouseEvent, button = getMouseButton(event.button)): boolean {
    const position = this.getNativeMousePosition(event);

    // Only the final release ends an admitted pointer sequence.
    if (!this.isMouseButtonPressed()) {
      return this.pushNativePointerMotion(event, button, position);
    }
    const state = this.mouseState!;
    const interaction = this.mouseInteraction!;

    if (event.buttons !== 0) {
      state.buttonMask = getNativeMouseButtonMask(event.buttons);

      return this.pushNativePointerMotion(event, button, position);
    }
    this.nativePointerButton = MouseButton.None;
    const handled = this.pushNativePointerButton(event, position, false, button);
    const pointerEvent = this.createPointerEvent(event, position, interaction);

    if (!interaction.inputHandled && !handled) {
      if (this.isClick(interaction, position)) { this.dispatchEvent(EVENT_TYPE_CLICK, pointerEvent); }
      this.dispatchEvent(EVENT_TYPE_TOUCH_END, pointerEvent);
    }

    return handled || interaction.inputHandled;
  }

  private countPointerClick (event: MouseEvent): void {
    if (!this.usePointerEvents) {
      this.pointerClickCount = event.detail || 1;

      return;
    }
    // PointerEvent.detail is zero; count nearby presses within 500ms.
    const now = Date.now();

    this.pointerClickCount = this.pointerClickTime && now - this.pointerClickTime < 500 &&
      Math.abs(event.pageX - this.pointerClickPosition.x) < 4 && Math.abs(event.pageY - this.pointerClickPosition.y) < 4
      ? this.pointerClickCount + 1 : 1;
    this.pointerClickTime = now;
    this.pointerClickPosition.set(event.pageX, event.pageY);
  }

  private pushNativePointerButton (event: MouseEvent, position: Vector2, pressed: boolean, button = getMouseButton(event.button)): boolean {
    const input = new InputEventMouseButton();

    this.copyMouseFields(input, event, position);
    input.device = InputEvent.deviceIdMouse;
    input.buttonIndex = button;
    input.buttonMask = pressed ? getNativeMouseButtonMask(event.buttons) | getMouseButtonBit(button) : MouseButtonMask.None;
    input.pressed = pressed;
    input.doubleClick = this.pointerClickCount > 1;

    return this.dispatchNativeMouseInput(input);
  }

  private pushNativePointerMotion (event: MouseEvent, button = getMouseButton(event.button), position?: Vector2): boolean {
    if (this.isTouchPointer(event)) { return false; }
    position ??= this.getNativeMousePosition(event);
    const state = this.mouseState;
    const previousPosition = state?.lastInput.position ?? position;
    const interaction = this.mouseInteraction ??= this.createCompositionInteraction(position);
    const input = new InputEventMouseMotion();

    this.copyMouseFields(input, event, position);
    input.device = InputEvent.deviceIdMouse;
    input.buttonIndex = button;
    input.buttonMask = this.mouseState?.buttonMask ?? MouseButtonMask.None;
    input.pressed = input.buttonMask !== MouseButtonMask.None;
    input.relative.set(position.x - previousPosition.x, position.y - previousPosition.y);
    input.screenRelative.copyFrom(input.relative);
    input.velocity.copyFrom(this.getVelocity(position, previousPosition, state?.lastTime ?? performance.now()));
    input.screenVelocity.copyFrom(input.velocity);
    if ('pressure' in event) {
      const pointer = event as PointerEvent;

      input.pressure = pointer.pressure; input.tilt.set(pointer.tiltX, pointer.tiltY);
    }
    const handled = this.dispatchNativeMouseInput(input);

    if (!handled && (!input.pressed || !interaction.inputHandled)) {
      this.dispatchEvent(EVENT_TYPE_TOUCH_MOVE, this.createPointerEvent(event, position, interaction, input.velocity));
    }
    interaction.inputHandled ||= handled;

    return handled;
  }

  private onNativePointingMove = (event: MouseEvent): void => {
    if (!this.enabled || !this.target || this.isTouchPointer(event) || !this.ownsNativeMouseEvent(event)) {
      return;
    }
    this.preventAcceptedDefault(event, this.pushNativePointerMotion(event, this.usePointerEvents ? getMouseButton(event.button) : MouseButton.None));
  };

  private onNativeTouchStart = (event: TouchEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.focusTarget();
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state: TouchInputState = {
        position: position.clone(), lastTime: performance.now(), interaction: this.createCompositionInteraction(position),
      };

      this.touchStates.set(touch.identifier, state);
      const handled = this.pushNativeScreenTouch(touch.identifier, position, true, false, false);

      state.interaction.inputHandled = handled;
      if (!handled) {
        const pointerEvent = this.createPointerEvent(event, position, state.interaction);

        this.dispatchEvent(EVENT_TYPE_TOUCH_START, pointerEvent);
      }
      this.consumeNativeEvent(event, handled);
    }
    this.preventTouchDefaults(event);
  };

  private onNativeTouchMove = (event: TouchEvent): void => {
    if (!this.enabled || !this.touchStates.size) {
      return;
    }
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state = this.touchStates.get(touch.identifier);

      if (!state) { continue; }
      const relative = new Vector2(position.x - state.position.x, position.y - state.position.y);
      const velocity = this.getVelocity(position, state.position, state.lastTime);
      const handled = this.pushNativeScreenDrag(touch.identifier, position, relative, velocity);

      state.interaction.inputHandled ||= handled;
      if (!handled && !state.interaction.inputHandled) {
        const pointerEvent = this.createPointerEvent(event, position, state.interaction, velocity);

        this.dispatchEvent(EVENT_TYPE_TOUCH_MOVE, pointerEvent);
      }
      state.position.copyFrom(position); state.lastTime = performance.now();
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
    this.dispatchNativeFocusInput(FocusEventType.FocusGained);
  };

  private onCanvasBlur = (): void => {
    this.dispatchNativeFocusInput(FocusEventType.FocusLost);
  };

  private readonly onWindowFocus = (): void => {
    this.dispatchNativeFocusInput(FocusEventType.WindowFocusGained);
  };

  private readonly onWindowBlur = (): void => {
    this.dispatchNativeFocusInput(FocusEventType.WindowFocusLost);
  };

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
    if (pressed) { this.pressedKeys.set(event.code, input); } else { this.pressedKeys.delete(event.code); }
    this.preventAcceptedDefault(event, this.pushInput(input));
  }

  private handleNativeTouchEnd (event: TouchEvent, canceled: boolean): void {
    if (!this.enabled || !this.touchStates.size) {
      return;
    }
    for (const touch of Array.from(event.changedTouches)) {
      const position = this.getCanvasPosition(touch.clientX, touch.clientY);
      const state = this.touchStates.get(touch.identifier);

      if (!state) {
        continue;
      }
      const handled = this.pushNativeScreenTouch(touch.identifier, position, false, canceled, false);
      const pointerEvent = this.createPointerEvent(event, position, state.interaction);

      if (!canceled && !state.interaction.inputHandled && !handled && this.isClick(state.interaction, position)) {
        this.dispatchEvent(EVENT_TYPE_CLICK, pointerEvent);
      }
      if (!handled && !canceled && !state.interaction.inputHandled) {
        this.dispatchEvent(EVENT_TYPE_TOUCH_END, pointerEvent);
      }
      this.touchStates.delete(touch.identifier);
      this.consumeNativeEvent(event, handled || state.interaction.inputHandled || !this.allowPropagation);
    }
    if (!canceled) { this.preventTouchDefaults(event); }
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

    return this.dispatchNativeMouseInput(input);
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

    return this.dispatchNativeMouseInput(input);
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
    input.buttonMask = this.mouseState?.buttonMask ?? MouseButtonMask.None;
    input.factor = factor;
    input.pressed = true;

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
    input: InputEventMouse,
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

    for (const composition of this.engine.sceneServer.compositions) {
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
      for (const composition of this.engine.sceneServer.compositions) {
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

  private createCompositionInteraction (position: Vector2): CompositionInteractionState {
    return {
      start: position.clone(),
      inputHandled: false,
    };
  }

  private getVelocity (position: Vector2, previousPosition: Vector2, previousTime: number): Vector2 {
    const elapsed = Math.max(performance.now() - previousTime, 1);

    return new Vector2(
      (position.x - previousPosition.x) / elapsed,
      (position.y - previousPosition.y) / elapsed,
    );
  }

  private isClick (state: CompositionInteractionState, position: Vector2): boolean {
    return Math.abs(position.x - state.start.x) + Math.abs(position.y - state.start.y) < 4;
  }

  private createPointerEvent (
    origin: Event,
    position: Vector2,
    state: CompositionInteractionState,
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

  private preventAcceptedDefault (event: Event, handled: boolean): void {
    // Allow document-capture events to continue to their targets.
    if (handled && !this.allowPropagation && event.cancelable) { event.preventDefault(); }
  }

  /** Dispatches an input event without changing native input state. */
  pushInput (input: InputEvent): boolean {
    input.clearAccepted();
    this.emit('input', input);

    return input.isAccepted();
  }

  private dispatchNativeMouseInput (input: InputEventMouseButton | InputEventMouseMotion): boolean {
    let state: MouseInputState | null = null;

    if (input instanceof InputEventMouseButton) {
      if (input.isPressed()) {
        this.mouseState = {
          initiatingButton: input.buttonIndex, buttonMask: input.buttonMask, lastInput: input, lastTime: performance.now(),
        };
      } else {
        input.buttonMask = MouseButtonMask.None;
        if (this.mouseState) {
          this.mouseState.buttonMask = MouseButtonMask.None;
          this.mouseState.initiatingButton = MouseButton.None;
          this.mouseState.lastInput = input;
        }
      }
      state = this.mouseState;
    } else {
      if (!this.isMouseButtonPressed()) { input.buttonMask = MouseButtonMask.None; }
      this.mouseState ??= {
        initiatingButton: MouseButton.None, buttonMask: MouseButtonMask.None, lastInput: input, lastTime: performance.now(),
      };
      state = this.mouseState;
      state.buttonMask = input.buttonMask;
      state.lastInput = input;
      input.pressed = input.buttonMask !== MouseButtonMask.None;
    }
    const handled = this.pushInput(input);

    if (state) { state.lastTime = performance.now(); }

    return handled;
  }

  private isMouseButtonPressed (): boolean {
    return (this.mouseState?.buttonMask ?? MouseButtonMask.None) !== MouseButtonMask.None;
  }

  private cancelNativePointerInput (): void {
    const state = this.mouseState;

    if (!state || !this.isMouseButtonPressed()) { return; }
    const event = new InputEventMouseButton();

    this.copyMouseInput(event, state.lastInput);
    event.buttonIndex = state.initiatingButton;
    event.canceled = true;
    this.nativePointerButton = MouseButton.None;
    this.dispatchNativeMouseInput(event);
  }

  private copyMouseInput (target: InputEventMouse, source: InputEventMouse): void {
    target.device = source.device;
    target.position.copyFrom(source.position);
    target.globalPosition.copyFrom(source.globalPosition);
    target.shiftPressed = source.shiftPressed;
    target.altPressed = source.altPressed;
    target.ctrlPressed = source.ctrlPressed;
    target.metaPressed = source.metaPressed;
    target.commandOrControlAutoremap = source.commandOrControlAutoremap;
  }

  private prepareNativeFocusInput (type: FocusEventType): boolean {
    if (type === FocusEventType.FocusGained) {
      if (this.viewFocused) { return false; }
      this.viewFocused = true; this.hadFocus = true;
    } else if (type === FocusEventType.FocusLost) {
      if (!this.viewFocused) { return false; }
      this.viewFocused = false;
      this.cancelNativePointerInput(); this.releasePressedKeys();
    } else if (type === FocusEventType.WindowFocusGained) {
      if (this.windowFocused) { return false; }
      this.windowFocused = true;
      if (!this.hadFocus) { return false; }
    } else {
      if (!this.windowFocused) { return false; }
      this.windowFocused = false;
      if (!this.hadFocus) { return false; }
      this.cancelNativePointerInput(); this.releasePressedKeys();
      this.touchStates.clear(); this.mouseFromTouchIndex = null;
    }

    return true;
  }

  private dispatchNativeFocusInput (type: FocusEventType): void {
    if (this.prepareNativeFocusInput(type)) { this.pushInput(new InputEventFocus(type)); }
  }

  private releasePressedKeys (): void {
    const keys = Array.from(this.pressedKeys.values());

    this.pressedKeys.clear();
    for (const pressed of keys) {
      const released = Object.assign(new InputEventKey(), pressed);

      released.pressed = false; released.echo = false; this.pushInput(released);
    }
  }

  private getNativeMousePosition (event: MouseEvent): Vector2 {
    if (this.target && this.target.ownerDocument?.pointerLockElement === this.target && this.mouseState) {
      return this.mouseState.lastInput.position.clone().add(new Vector2(event.movementX, event.movementY));
    }

    return this.getCanvasPosition(event.clientX, event.clientY);
  }

  private preventTouchDefaults (event: TouchEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  private focusTarget (): void {
    this.hadFocus = true;
    if (typeof this.target?.focus === 'function') {
      this.target.focus();
    }
  }

  private resetInputState (): void {
    this.pressedKeys.clear(); this.hadFocus = false;
    this.viewFocused = false; this.windowFocused = true;
    this.mouseState = null;
    this.mouseInteraction = null;
    this.nativePointerButton = MouseButton.None;
    this.pointerClickTime = 0;
    this.pointerClickCount = 0;
    this.touchStates.clear();
    this.mouseFromTouchIndex = null;
  }

  private isTouchPointer (event: MouseEvent): boolean {
    return 'pointerType' in event && event.pointerType === 'touch';
  }

  private ownsNativeEvent (event: Event): boolean {
    return event.target === this.target || typeof Node !== 'undefined' && event.target instanceof Node &&
      typeof this.target?.contains === 'function' && this.target.contains(event.target);
  }

  private ownsNativeMouseEvent (event: Event): boolean {
    return this.ownsNativeEvent(event) || this.isMouseButtonPressed();
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

function getNativeMouseButtonMask (buttons: number): MouseButtonMask {
  return (buttons & 7) |
    (buttons & 8 ? MouseButtonMask.Xbutton1 : MouseButtonMask.None) |
    (buttons & 16 ? MouseButtonMask.Xbutton2 : MouseButtonMask.None);
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
