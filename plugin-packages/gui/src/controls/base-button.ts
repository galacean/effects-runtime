import {
  Control,
  EventEmitter,
  FocusMode,
  MouseButton,
  MouseButtonMask,
  MouseFilter,
} from '@galacean/effects';
import type {
  ControlEvent,
  Engine,
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  RootControl,
} from '@galacean/effects';
import { ButtonActionMode, ButtonDrawMode } from './enums';
import type { BaseButtonData } from '../data';

export type BaseButtonEvent = ControlEvent & {
  buttonDown: [],
  buttonUp: [],
  pressed: [],
  toggled: [pressed: boolean],
};

export type ButtonGroupEvent = {
  pressed: [button: BaseButton],
};

export class ButtonGroup {
  private readonly buttons = new Set<BaseButton>();
  private readonly eventEmitter = new EventEmitter<ButtonGroupEvent>();

  allowUnpress = false;

  on<E extends keyof ButtonGroupEvent> (
    eventName: E,
    listener: EventEmitterListener<ButtonGroupEvent[E]>,
  ): void {
    this.eventEmitter.on(eventName, listener);
  }

  off<E extends keyof ButtonGroupEvent> (
    eventName: E,
    listener: EventEmitterListener<ButtonGroupEvent[E]>,
  ): void {
    this.eventEmitter.off(eventName, listener);
  }

  getPressedButton (): BaseButton | null {
    for (const button of this.buttons) {
      if (button.buttonPressed) {
        return button;
      }
    }

    return null;
  }

  getButtons (): BaseButton[] {
    return Array.from(this.buttons);
  }

  addButton (button: BaseButton): void {
    this.buttons.add(button);
    if (button.buttonPressed) {
      for (const peer of this.buttons) {
        if (peer !== button) {
          peer.setPressedFromGroup(false, false);
        }
      }
    }
  }

  removeButton (button: BaseButton): void {
    this.buttons.delete(button);
  }

  select (button: BaseButton, signal: boolean, emitPressed = false): boolean {
    if (!this.buttons.has(button)) {
      return false;
    }
    if (button.buttonPressed && !this.allowUnpress) {
      if (emitPressed) {
        this.eventEmitter.emit('pressed', button);
      }

      return false;
    }

    const next = !button.buttonPressed;

    if (next) {
      for (const peer of this.buttons) {
        if (peer !== button) {
          peer.setPressedFromGroup(false, signal);
        }
      }
    }
    button.setPressedFromGroup(next, signal);
    if (emitPressed) {
      this.eventEmitter.emit('pressed', button);
    }

    return true;
  }
}

export class BaseButton extends Control {
  private readonly buttonEventEmitter = new EventEmitter<BaseButtonEvent>();
  private _disabled = false;
  private _toggleMode = false;
  private _buttonPressed = false;
  private _buttonMask = MouseButtonMask.Left;
  private _buttonGroup: ButtonGroup | null = null;
  private hovered = false;
  private pressing = false;
  private pressInside = false;
  private mousePressing = false;
  private keyboardPressing = false;
  private touchIndex = -1;
  private readonly controlStateChanged = () => {
    if (!this.visible || !this.enabled) {
      this.cancelPress();
    }
  };

  actionMode = ButtonActionMode.Release;
  keepPressedOutside = false;

  constructor (engine: Engine) {
    super(engine);
    this.focusMode = FocusMode.All;
    this.mouseFilter = MouseFilter.Stop;
    this.on('visibilityChanged', this.controlStateChanged);
    this.on('enabledChanged', this.controlStateChanged);
  }

  get disabled (): boolean {
    return this._disabled;
  }

  set disabled (value: boolean) {
    if (this._disabled !== value) {
      this._disabled = value;
      if (value) {
        this.cancelPress();
      }
      this.root?.controlStateChanged(this);
    }
  }

  get toggleMode (): boolean {
    return this._toggleMode;
  }

  set toggleMode (value: boolean) {
    this._toggleMode = value;
  }

  get buttonPressed (): boolean {
    return this._buttonPressed;
  }

  set buttonPressed (value: boolean) {
    this.setPressed(value, true);
  }

  get buttonMask (): MouseButtonMask {
    return this._buttonMask;
  }

  set buttonMask (value: MouseButtonMask) {
    this._buttonMask = value;
  }

  get buttonGroup (): ButtonGroup | null {
    return this._buttonGroup;
  }

  set buttonGroup (value: ButtonGroup | null) {
    if (this._buttonGroup !== value) {
      this._buttonGroup?.removeButton(this);
      this._buttonGroup = value;
      value?.addButton(this);
    }
  }

  override on<E extends keyof BaseButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<BaseButtonEvent[E]>,
  ): void {
    if (eventName === 'buttonDown' || eventName === 'buttonUp'
      || eventName === 'pressed' || eventName === 'toggled') {
      this.buttonEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof BaseButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<BaseButtonEvent[E]>,
  ): void {
    if (eventName === 'buttonDown' || eventName === 'buttonUp'
      || eventName === 'pressed' || eventName === 'toggled') {
      this.buttonEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  setPressedNoSignal (value: boolean): void {
    this.setPressed(value, false);
  }

  isHovered (): boolean {
    return this.hovered;
  }

  isPressing (): boolean {
    return this.pressing && (this.pressInside || this.keepPressedOutside);
  }

  getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) {
      return ButtonDrawMode.Disabled;
    }
    const visuallyPressed = this.isPressing() || this.buttonPressed;

    if (visuallyPressed && this.hovered) {
      return ButtonDrawMode.HoverPressed;
    }
    if (visuallyPressed) {
      return ButtonDrawMode.Pressed;
    }
    if (this.hovered) {
      return ButtonDrawMode.Hover;
    }

    return ButtonDrawMode.Normal;
  }

  override getEffectiveMouseFilter (): MouseFilter {
    return this.disabled ? MouseFilter.Ignore : super.getEffectiveMouseFilter();
  }

  override getFocusModeWithOverride (): FocusMode {
    return this.disabled ? FocusMode.None : super.getFocusModeWithOverride();
  }

  override onMouseEnter (): void {
    this.hovered = true;
    if (this.mousePressing) {
      this.pressInside = true;
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.hovered = this.hasPoint(event.position);
    if (this.mousePressing) {
      this.pressInside = this.hovered;
    }
  }

  override onMouseLeave (): void {
    this.hovered = false;
    if (this.mousePressing) {
      this.pressInside = false;
    }
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (this.disabled || !hasButton(this.buttonMask, event.buttonIndex)) {
      return;
    }
    this.mousePressing = true;
    this.beginPress(true);
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.mousePressing || !hasButton(this.buttonMask, event.buttonIndex)) {
      return;
    }
    const activate = !event.canceled && (this.keepPressedOutside || this.hasPoint(event.position));

    this.mousePressing = false;
    this.finishPress(activate);
    event.accept();
  }

  override onTouchDown (event: InputEventScreenTouch): void {
    if (this.disabled || this.touchIndex !== -1) {
      return;
    }
    this.touchIndex = event.index;
    this.beginPress(true);
    event.accept();
  }

  override onTouchMove (event: InputEventScreenDrag): void {
    if (event.index === this.touchIndex) {
      this.pressInside = this.hasPoint(event.position);
      event.accept();
    }
  }

  override onTouchUp (event: InputEventScreenTouch): void {
    if (event.index !== this.touchIndex) {
      return;
    }
    const activate = !event.canceled && (this.keepPressedOutside || this.hasPoint(event.position));

    this.touchIndex = -1;
    this.finishPress(activate);
    event.accept();
  }

  override onKeyDown (event: InputEventKey): void {
    if (this.disabled || event.echo || this.keyboardPressing || !isActivationKey(event.keycode)) {
      return;
    }
    this.keyboardPressing = true;
    this.beginPress(true);
    event.accept();
  }

  override onKeyUp (event: InputEventKey): void {
    if (!this.keyboardPressing || !isActivationKey(event.keycode)) {
      return;
    }
    this.keyboardPressing = false;
    this.finishPress(true);
    event.accept();
  }

  override onLostFocus (): void {
    this.cancelPress();
  }

  override onScrollBegin (): void {
    this.cancelPress();
  }

  override onDestroy (): void {
    this.off('visibilityChanged', this.controlStateChanged);
    this.off('enabledChanged', this.controlStateChanged);
    this.buttonGroup = null;
    this.cancelPress();
  }

  setPressedFromGroup (value: boolean, signal: boolean): void {
    this.setPressedDirect(value, signal);
  }

  protected override onRootChanged (previousRoot: RootControl | null, nextRoot: RootControl | null): void {
    if (!nextRoot) {
      this.cancelPress();
    }
  }

  private setPressed (value: boolean, signal: boolean): void {
    if (this.buttonGroup && value) {
      if (!this.buttonPressed) {
        this.buttonGroup.select(this, signal);
      }

      return;
    }
    this.setPressedDirect(value, signal);
  }

  private setPressedDirect (value: boolean, signal: boolean): void {
    if (this._buttonPressed !== value) {
      this._buttonPressed = value;
      if (signal) {
        this.buttonEventEmitter.emit('toggled', value);
      }
    }
  }

  private beginPress (inside: boolean): void {
    if (this.pressing) {
      return;
    }
    this.pressing = true;
    this.pressInside = inside;
    this.buttonEventEmitter.emit('buttonDown');
    if (this.actionMode === ButtonActionMode.Press) {
      this.activate();
    }
  }

  private finishPress (activate: boolean): void {
    if (!this.pressing) {
      return;
    }
    this.pressing = false;
    this.pressInside = false;
    this.buttonEventEmitter.emit('buttonUp');
    if (activate && this.actionMode === ButtonActionMode.Release) {
      this.activate();
    }
  }

  private cancelPress (): void {
    const wasPressing = this.pressing;

    this.pressing = false;
    this.pressInside = false;
    this.mousePressing = false;
    this.keyboardPressing = false;
    this.touchIndex = -1;
    if (wasPressing) {
      this.buttonEventEmitter.emit('buttonUp');
    }
  }

  private activate (): void {
    if (this.toggleMode) {
      if (this.buttonGroup) {
        if (!this.buttonGroup.select(this, true, true) && !this.buttonPressed) {
          return;
        }
      } else {
        this.setPressedDirect(!this.buttonPressed, true);
      }
    }
    this.buttonEventEmitter.emit('pressed');
  }

  override fromData (data: BaseButtonData): void {
    super.fromData(data);
    if (data.disabled !== undefined) {
      this.disabled = data.disabled;
    }
    if (data.toggleMode !== undefined) {
      this.toggleMode = data.toggleMode;
    }
    if (data.buttonPressed !== undefined) {
      this.setPressedNoSignal(data.buttonPressed);
    }
    if (data.buttonMask !== undefined) {
      this.buttonMask = data.buttonMask;
    }
    if (data.actionMode !== undefined) {
      this.actionMode = data.actionMode;
    }
    if (data.keepPressedOutside !== undefined) {
      this.keepPressedOutside = data.keepPressedOutside;
    }
  }
}

function hasButton (mask: MouseButtonMask, button: MouseButton): boolean {
  switch (button) {
    case MouseButton.Left:
      return (mask & MouseButtonMask.Left) !== 0;
    case MouseButton.Right:
      return (mask & MouseButtonMask.Right) !== 0;
    case MouseButton.Middle:
      return (mask & MouseButtonMask.Middle) !== 0;
    case MouseButton.Xbutton1:
      return (mask & MouseButtonMask.Xbutton1) !== 0;
    case MouseButton.Xbutton2:
      return (mask & MouseButtonMask.Xbutton2) !== 0;
    default:
      return false;
  }
}

function isActivationKey (keycode: string): boolean {
  return keycode === 'Enter' || keycode === 'Space' || keycode === ' ';
}
