import type { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { KeyLocation, MouseButton, MouseButtonMask } from './enums';

function transformPoint (transform: Matrix3, value: Vector2): Vector2 {
  const elements = transform.elements;

  return new Vector2(
    elements[0] * value.x + elements[3] * value.y + elements[6],
    elements[1] * value.x + elements[4] * value.y + elements[7],
  );
}

function transformVector (transform: Matrix3, value: Vector2): Vector2 {
  const elements = transform.elements;

  return new Vector2(
    elements[0] * value.x + elements[3] * value.y,
    elements[1] * value.x + elements[4] * value.y,
  );
}

export class InputEvent {
  static readonly deviceIdEmulation = -1;
  static readonly deviceIdInternal = -2;
  static readonly deviceIdKeyboard = 16;
  static readonly deviceIdMouse = 32;

  device = 0;
  pressed = false;
  canceled = false;
  private _accepted = false;

  accept (): void {
    this._accepted = true;
  }

  clearAccepted (): void {
    this._accepted = false;
  }

  isAccepted (): boolean {
    return this._accepted;
  }

  isPressed (): boolean {
    return this.pressed && !this.canceled;
  }

  isReleased (): boolean {
    return !this.pressed && !this.canceled;
  }

  isCanceled (): boolean {
    return this.canceled;
  }

  isEcho (): boolean {
    return false;
  }

  xformedBy (transform: Matrix3): InputEvent {
    return this;
  }
}

export class InputEventWithModifiers extends InputEvent {
  commandOrControlAutoremap = false;
  shiftPressed = false;
  altPressed = false;
  metaPressed = false;
  ctrlPressed = false;

  protected copyModifiersTo (event: InputEventWithModifiers): void {
    event.device = this.device;
    event.pressed = this.pressed;
    event.canceled = this.canceled;
    event.commandOrControlAutoremap = this.commandOrControlAutoremap;
    event.shiftPressed = this.shiftPressed;
    event.altPressed = this.altPressed;
    event.metaPressed = this.metaPressed;
    event.ctrlPressed = this.ctrlPressed;
  }
}

export class InputEventKey extends InputEventWithModifiers {
  keycode = '';
  physicalKeycode = '';
  keyLabel = '';
  unicode = 0;
  location = KeyLocation.Unspecified;
  echo = false;

  override isEcho (): boolean {
    return this.echo;
  }
}

export class InputEventMouse extends InputEventWithModifiers {
  buttonMask = MouseButtonMask.None;
  position = new Vector2();
  globalPosition = new Vector2();

  protected copyMouseTo (event: InputEventMouse): void {
    this.copyModifiersTo(event);
    event.buttonMask = this.buttonMask;
    event.position.copyFrom(this.position);
    event.globalPosition.copyFrom(this.globalPosition);
  }
}

export class InputEventMouseButton extends InputEventMouse {
  factor = 1;
  buttonIndex = MouseButton.None;
  doubleClick = false;

  override xformedBy (transform: Matrix3): InputEventMouseButton {
    const event = new InputEventMouseButton();

    this.copyMouseTo(event);
    event.position.copyFrom(transformPoint(transform, this.position));
    event.factor = this.factor;
    event.buttonIndex = this.buttonIndex;
    event.doubleClick = this.doubleClick;

    return event;
  }
}

export class InputEventMouseMotion extends InputEventMouse {
  tilt = new Vector2();
  pressure = 0;
  relative = new Vector2();
  screenRelative = new Vector2();
  velocity = new Vector2();
  screenVelocity = new Vector2();
  penInverted = false;

  override xformedBy (transform: Matrix3): InputEventMouseMotion {
    const event = new InputEventMouseMotion();

    this.copyMouseTo(event);
    event.position.copyFrom(transformPoint(transform, this.position));
    event.tilt.copyFrom(this.tilt);
    event.pressure = this.pressure;
    event.relative.copyFrom(transformVector(transform, this.relative));
    event.screenRelative.copyFrom(this.screenRelative);
    event.velocity.copyFrom(transformVector(transform, this.velocity));
    event.screenVelocity.copyFrom(this.screenVelocity);
    event.penInverted = this.penInverted;

    return event;
  }
}

export class InputEventScreenTouch extends InputEvent {
  index = 0;
  position = new Vector2();
  doubleTap = false;

  override xformedBy (transform: Matrix3): InputEventScreenTouch {
    const event = new InputEventScreenTouch();

    event.device = this.device;
    event.pressed = this.pressed;
    event.canceled = this.canceled;
    event.index = this.index;
    event.position.copyFrom(transformPoint(transform, this.position));
    event.doubleTap = this.doubleTap;

    return event;
  }
}

export class InputEventScreenDrag extends InputEvent {
  index = 0;
  position = new Vector2();
  relative = new Vector2();
  screenRelative = new Vector2();
  velocity = new Vector2();
  screenVelocity = new Vector2();
  pressure = 0;
  tilt = new Vector2();
  penInverted = false;

  override xformedBy (transform: Matrix3): InputEventScreenDrag {
    const event = new InputEventScreenDrag();

    event.device = this.device;
    event.pressed = this.pressed;
    event.canceled = this.canceled;
    event.index = this.index;
    event.position.copyFrom(transformPoint(transform, this.position));
    event.relative.copyFrom(transformVector(transform, this.relative));
    event.screenRelative.copyFrom(this.screenRelative);
    event.velocity.copyFrom(transformVector(transform, this.velocity));
    event.screenVelocity.copyFrom(this.screenVelocity);
    event.pressure = this.pressure;
    event.tilt.copyFrom(this.tilt);
    event.penInverted = this.penInverted;

    return event;
  }
}
