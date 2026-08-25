import { EventEmitter, FocusMode, MouseButton, MouseFilter, math } from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  InputEventScreenDrag,
  InputEventScreenTouch,
  RootControl,
} from '@galacean/effects';
import { Orientation } from '../layout/enums';
import { Range } from '../scroll/range';
import type { RangeEvent } from '../scroll/range';
import { cloneColor, GUIStyle } from '../style';

export type SliderEvent = RangeEvent & {
  dragStarted: [],
  dragEnded: [valueChanged: boolean],
};

type GrabberRect = {
  x: number,
  y: number,
  width: number,
  height: number,
};

const CONTROL_THICKNESS = 16;
const GRABBER_SIZE = 14;
const TRACK_THICKNESS = 4;

export class Slider extends Range {
  private readonly sliderEventEmitter = new EventEmitter<SliderEvent>();
  private _orientation: Orientation;
  private _editable = true;
  private dragging = false;
  private hovered = false;
  private dragPosition = 0;
  private dragRatio = 0;
  private dragInitialValue = 0;
  private touchIndex = -1;

  scrollable = true;
  trackColor: math.Color;
  fillColor: math.Color;
  grabberColor: math.Color;
  grabberHighlightedColor: math.Color;
  grabberDisabledColor: math.Color;

  constructor (engine: Engine, orientation = Orientation.Horizontal) {
    super(engine);
    const style = GUIStyle.current;

    this._orientation = orientation;
    this.focusMode = FocusMode.All;
    this.mouseFilter = MouseFilter.Stop;
    this.trackColor = cloneColor(style.trackColor);
    this.fillColor = cloneColor(style.fillColor);
    this.grabberColor = cloneColor(style.normalColor);
    this.grabberHighlightedColor = cloneColor(style.accentHoverColor);
    this.grabberDisabledColor = cloneColor(style.disabledColor);
  }

  get orientation (): Orientation {
    return this._orientation;
  }

  get editable (): boolean {
    return this._editable;
  }

  set editable (value: boolean) {
    if (this._editable !== value) {
      this._editable = value;
      if (!value) {
        this.endDrag();
      }
    }
  }

  set orientation (value: Orientation) {
    if (value !== Orientation.Horizontal && value !== Orientation.Vertical) {
      throw new RangeError('Invalid Slider orientation.');
    }
    if (this._orientation !== value) {
      this._orientation = value;
      this.updateMinimumSize();
    }
  }

  override on<E extends keyof SliderEvent> (
    eventName: E,
    listener: EventEmitterListener<SliderEvent[E]>,
  ): void {
    if (eventName === 'dragStarted' || eventName === 'dragEnded') {
      this.sliderEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof SliderEvent> (
    eventName: E,
    listener: EventEmitterListener<SliderEvent[E]>,
  ): void {
    if (eventName === 'dragStarted' || eventName === 'dragEnded') {
      this.sliderEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  override getMinimumSize (): math.Vector2 {
    return this.orientation === Orientation.Horizontal
      ? new math.Vector2(GRABBER_SIZE, CONTROL_THICKNESS)
      : new math.Vector2(CONTROL_THICKNESS, GRABBER_SIZE);
  }

  override draw (): void {
    const grabber = this.getGrabberRect();
    const color = !this.editable
      ? this.grabberDisabledColor
      : this.dragging || this.hovered ? this.grabberHighlightedColor : this.grabberColor;

    if (this.orientation === Orientation.Horizontal) {
      const centerY = (this.height - TRACK_THICKNESS) * 0.5;
      const fillWidth = grabber.x + grabber.width * 0.5;

      this.fillRect(0, centerY, this.width, TRACK_THICKNESS, this.trackColor);
      this.fillRect(0, centerY, fillWidth, TRACK_THICKNESS, this.fillColor);
    } else {
      const centerX = (this.width - TRACK_THICKNESS) * 0.5;
      const fillY = grabber.y + grabber.height * 0.5;

      this.fillRect(centerX, 0, TRACK_THICKNESS, this.height, this.trackColor);
      this.fillRect(centerX, fillY, TRACK_THICKNESS, this.height - fillY, this.fillColor);
    }
    this.fillRect(grabber.x, grabber.y, grabber.width, grabber.height, color);
  }

  override onMouseEnter (): void {
    this.hovered = true;
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.hovered = this.hasPoint(event.position);
    if (this.dragging) {
      this.updateDrag(this.getAxis(event.position));
      event.accept();
    }
  }

  override onMouseLeave (): void {
    this.hovered = false;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (!this.editable || event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.beginDrag(this.getAxis(event.position), this.getGrabberRect(), event.position);
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.dragging) {
      this.endDrag();
      event.accept();
    }
  }

  override onTouchDown (event: InputEventScreenTouch): void {
    if (!this.editable || this.touchIndex !== -1) {
      return;
    }
    this.touchIndex = event.index;
    this.beginDrag(this.getAxis(event.position), this.getGrabberRect(), event.position);
    event.accept();
  }

  override onTouchMove (event: InputEventScreenDrag): void {
    if (this.dragging && event.index === this.touchIndex) {
      this.updateDrag(this.getAxis(event.position));
      event.accept();
    }
  }

  override onTouchUp (event: InputEventScreenTouch): void {
    if (event.index === this.touchIndex) {
      this.touchIndex = -1;
      this.endDrag();
      event.accept();
    }
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    if (!this.editable || !this.scrollable) {
      return;
    }

    let direction = 0;

    if (event.buttonIndex === MouseButton.WheelUp || event.buttonIndex === MouseButton.WheelRight) {
      direction = 1;
    } else if (event.buttonIndex === MouseButton.WheelDown || event.buttonIndex === MouseButton.WheelLeft) {
      direction = -1;
    }
    if (direction !== 0) {
      const previous = this.value;

      this.value += direction * this.getIncrement() * event.factor;
      if (previous !== this.value) {
        event.accept();
      }
    }
  }

  override onKeyDown (event: InputEventKey): void {
    if (!this.editable) {
      return;
    }
    const increment = this.getIncrement();
    let target: number | undefined;

    if ((this.orientation === Orientation.Horizontal && event.keycode === 'ArrowLeft')
      || (this.orientation === Orientation.Vertical && event.keycode === 'ArrowDown')) {
      target = this.value - increment;
    } else if ((this.orientation === Orientation.Horizontal && event.keycode === 'ArrowRight')
      || (this.orientation === Orientation.Vertical && event.keycode === 'ArrowUp')) {
      target = this.value + increment;
    } else if (event.keycode === 'Home') {
      target = this.minValue;
    } else if (event.keycode === 'End') {
      target = this.maxValue;
    }

    if (target !== undefined) {
      const previous = this.value;

      this.value = target;
      if (previous !== this.value) {
        event.accept();
      }
    }
  }

  override onScrollBegin (): void {
    this.endDrag();
  }

  protected override onRootChanged (previousRoot: RootControl | null, nextRoot: RootControl | null): void {
    if (!nextRoot) {
      this.endDrag();
    }
  }

  private beginDrag (position: number, grabber: GrabberRect, point: math.Vector2): void {
    const insideGrabber = point.x >= grabber.x && point.x <= grabber.x + grabber.width
      && point.y >= grabber.y && point.y <= grabber.y + grabber.height;

    const initialValue = this.value;

    if (!insideGrabber) {
      this.setAsRatio(this.getRatioAt(position));
    }
    this.dragging = true;
    this.dragPosition = position;
    this.dragRatio = this.getAsRatio();
    this.dragInitialValue = initialValue;
    this.sliderEventEmitter.emit('dragStarted');
  }

  private updateDrag (position: number): void {
    const area = this.getUsableLength();

    if (area <= 0) {
      return;
    }
    const direction = this.orientation === Orientation.Horizontal ? 1 : -1;

    this.setAsRatio(this.dragRatio + direction * (position - this.dragPosition) / area);
  }

  private endDrag (): void {
    if (!this.dragging) {
      return;
    }
    const changed = this.value !== this.dragInitialValue;

    this.dragging = false;
    this.touchIndex = -1;
    this.sliderEventEmitter.emit('dragEnded', changed);
  }

  private getAxis (position: math.Vector2): number {
    return this.orientation === Orientation.Horizontal ? position.x : position.y;
  }

  private getAxisSize (): number {
    return this.orientation === Orientation.Horizontal ? this.width : this.height;
  }

  private getUsableLength (): number {
    return Math.max(0, this.getAxisSize() - GRABBER_SIZE);
  }

  private getRatioAt (position: number): number {
    const area = this.getUsableLength();
    const normalized = area > 0 ? (position - GRABBER_SIZE * 0.5) / area : 0;

    return this.orientation === Orientation.Horizontal ? normalized : 1 - normalized;
  }

  private getIncrement (): number {
    return this.step > 0 ? this.step : Math.max(0, this.maxValue - this.minValue) / 100;
  }

  private getGrabberRect (): GrabberRect {
    const offset = this.getUsableLength() * this.getAsRatio();

    return this.orientation === Orientation.Horizontal
      ? { x: offset, y: (this.height - GRABBER_SIZE) * 0.5, width: GRABBER_SIZE, height: GRABBER_SIZE }
      : { x: (this.width - GRABBER_SIZE) * 0.5, y: this.getUsableLength() - offset, width: GRABBER_SIZE, height: GRABBER_SIZE };
  }
}

export class HSlider extends Slider {
  constructor (engine: Engine) {
    super(engine, Orientation.Horizontal);
  }
}

export class VSlider extends Slider {
  constructor (engine: Engine) {
    super(engine, Orientation.Vertical);
  }
}
