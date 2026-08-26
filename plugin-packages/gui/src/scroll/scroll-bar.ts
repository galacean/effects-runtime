import {
  EventEmitter,
  FocusMode,
  MouseButton,
  effectsClass,
  math,
} from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import { Orientation } from '../layout/enums';
import { Range } from './range';
import type { RangeEvent } from './range';
import { cloneColor, GUIStyle } from '../style';
import type { ScrollBarData } from '../data';

export type ScrollBarEvent = RangeEvent & {
  scrolling: [],
};

type Highlight = 'none' | 'decrement' | 'track' | 'increment';

type GrabberRect = {
  x: number,
  y: number,
  width: number,
  height: number,
};

const BAR_SIZE = 12;
const BUTTON_SIZE = 12;
const MIN_GRABBER_SIZE = 12;
const PAGE_DIVISOR = 8;

/** A horizontal or vertical range scroll bar. */
export class ScrollBar extends Range {
  static readonly pageDivisor = PAGE_DIVISOR;

  private readonly scrollBarEventEmitter = new EventEmitter<ScrollBarEvent>();
  private _orientation: Orientation;
  private _customStep = -1;
  private highlight: Highlight = 'none';
  private decrementActive = false;
  private incrementActive = false;
  private dragging = false;
  private dragPosition = 0;
  private dragRatio = 0;

  trackColor: math.Color;
  buttonColor: math.Color;
  buttonActiveColor: math.Color;
  grabberColor: math.Color;
  grabberHoverColor: math.Color;
  grabberPressedColor: math.Color;
  arrowColor: math.Color;

  constructor (engine: Engine, orientation = Orientation.Vertical) {
    super(engine);
    const style = GUIStyle.current;

    this._orientation = orientation;
    this.step = 0;
    this.focusMode = FocusMode.Accessibility;
    this.trackColor = cloneColor(style.trackColor);
    this.buttonColor = cloneColor(style.normalColor);
    this.buttonActiveColor = cloneColor(style.hoverColor);
    this.grabberColor = cloneColor(style.normalColor);
    this.grabberHoverColor = cloneColor(style.accentColor);
    this.grabberPressedColor = cloneColor(style.accentHoverColor);
    this.arrowColor = cloneColor(style.textColor);
  }

  get orientation (): Orientation {
    return this._orientation;
  }

  set orientation (value: Orientation) {
    if (value !== Orientation.Horizontal && value !== Orientation.Vertical) {
      throw new RangeError('Invalid ScrollBar orientation.');
    }
    if (this._orientation !== value) {
      this._orientation = value;
      this.updateMinimumSize();
    }
  }

  get customStep (): number {
    return this._customStep;
  }

  set customStep (value: number) {
    if (!Number.isFinite(value)) {
      throw new RangeError('ScrollBar customStep must be finite.');
    }
    this._customStep = value;
  }

  override on<E extends keyof ScrollBarEvent> (
    eventName: E,
    listener: EventEmitterListener<ScrollBarEvent[E]>,
  ): void {
    if (eventName === 'scrolling') {
      this.scrollBarEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof ScrollBarEvent> (
    eventName: E,
    listener: EventEmitterListener<ScrollBarEvent[E]>,
  ): void {
    if (eventName === 'scrolling') {
      this.scrollBarEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  scroll (amount: number): void {
    this.scrollTo(this.value + amount);
  }

  scrollTo (position: number): void {
    const previous = this.value;

    this.setValue(position);
    if (previous !== this.value) {
      this.scrollBarEventEmitter.emit('scrolling');
    }
  }

  override getMinimumSize (): math.Vector2 {
    const main = BUTTON_SIZE * 2 + MIN_GRABBER_SIZE;

    return this.orientation === Orientation.Horizontal
      ? new math.Vector2(main, BAR_SIZE)
      : new math.Vector2(BAR_SIZE, main);
  }

  override draw (): void {
    const horizontal = this.orientation === Orientation.Horizontal;
    const axisSize = horizontal ? this.width : this.height;
    const trackLength = Math.max(0, axisSize - BUTTON_SIZE * 2);
    const decrementColor = this.decrementActive ? this.buttonActiveColor : this.buttonColor;
    const incrementColor = this.incrementActive ? this.buttonActiveColor : this.buttonColor;
    const grabber = this.getGrabberRect();
    const grabberColor = this.dragging
      ? this.grabberPressedColor
      : this.highlight === 'track' ? this.grabberHoverColor : this.grabberColor;

    if (horizontal) {
      this.fillRect(0, 0, BUTTON_SIZE, this.height, decrementColor);
      this.fillRect(BUTTON_SIZE, 0, trackLength, this.height, this.trackColor);
      this.fillRect(axisSize - BUTTON_SIZE, 0, BUTTON_SIZE, this.height, incrementColor);
      this.fillTriangle(7.5, 3, 7.5, 9, 4, 6, this.arrowColor);
      this.fillTriangle(axisSize - 7.5, 3, axisSize - 7.5, 9, axisSize - 4, 6, this.arrowColor);
    } else {
      this.fillRect(0, 0, this.width, BUTTON_SIZE, decrementColor);
      this.fillRect(0, BUTTON_SIZE, this.width, trackLength, this.trackColor);
      this.fillRect(0, axisSize - BUTTON_SIZE, this.width, BUTTON_SIZE, incrementColor);
      this.fillTriangle(3, 7.5, 9, 7.5, 6, 4, this.arrowColor);
      this.fillTriangle(3, axisSize - 7.5, 9, axisSize - 7.5, 6, axisSize - 4, this.arrowColor);
    }
    this.fillRect(grabber.x, grabber.y, grabber.width, grabber.height, grabberColor);
  }

  override onMouseEnter (location: math.Vector2): void {
    this.updateHighlight(this.getAxis(location));
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const position = this.getAxis(event.position);

    if (this.dragging) {
      const area = this.getAreaSize();

      if (area > 0) {
        this.setAsRatio(this.dragRatio + (position - this.dragPosition) / area);
      }

      return;
    }
    this.updateHighlight(position);
  }

  override onMouseLeave (): void {
    if (!this.dragging) {
      this.highlight = 'none';
    }
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    const position = this.getAxis(event.position);
    const total = this.getAxisSize();
    const grabberOffset = this.getGrabberOffset();
    const grabberSize = this.getGrabberSize();
    const trackPosition = position - BUTTON_SIZE;

    if (position < BUTTON_SIZE) {
      this.decrementActive = true;
      this.scroll(-this.getIncrement());
    } else if (position > total - BUTTON_SIZE) {
      this.incrementActive = true;
      this.scroll(this.getIncrement());
    } else if (trackPosition < grabberOffset) {
      this.scroll(-this.getPageIncrement());
    } else if (trackPosition < grabberOffset + grabberSize) {
      this.dragging = true;
      this.dragPosition = position;
      this.dragRatio = this.getAsRatio();
    } else {
      this.scroll(this.getPageIncrement());
    }
    event.accept();
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }
    this.decrementActive = false;
    this.incrementActive = false;
    this.dragging = false;
    this.updateHighlight(this.getAxis(event.position));
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) {
      return;
    }
    const previous = this.value;
    const direction = event.buttonIndex === MouseButton.WheelUp ? -1 : 1;
    const wheelIncrement = this.page > 0
      ? this.page / PAGE_DIVISOR
      : (this.maxValue - this.minValue) / 16;
    const amount = Math.max(wheelIncrement * event.factor, Math.max(0, this.step));

    this.scroll(direction * amount);
    if (this.value !== previous) {
      event.accept();
    }
  }

  override onKeyDown (event: InputEventKey): void {
    let target: number | undefined;
    const increment = this.getIncrement();

    if ((this.orientation === Orientation.Horizontal && event.keycode === 'ArrowLeft') ||
      (this.orientation === Orientation.Vertical && event.keycode === 'ArrowUp')) {
      target = this.value - increment;
    } else if ((this.orientation === Orientation.Horizontal && event.keycode === 'ArrowRight') ||
      (this.orientation === Orientation.Vertical && event.keycode === 'ArrowDown')) {
      target = this.value + increment;
    } else if (event.keycode === 'Home') {
      target = this.minValue;
    } else if (event.keycode === 'End') {
      target = this.maxValue;
    }
    if (target !== undefined) {
      const previous = this.value;

      this.scrollTo(target);
      if (this.value !== previous) {
        event.accept();
      }
    }
  }

  override onScrollBegin (): void {
    this.decrementActive = false;
    this.incrementActive = false;
    this.dragging = false;
  }

  private getAxis (position: math.Vector2): number {
    return this.orientation === Orientation.Horizontal ? position.x : position.y;
  }

  private getAxisSize (): number {
    return this.orientation === Orientation.Horizontal ? this.width : this.height;
  }

  private getIncrement (): number {
    return this.customStep >= 0 ? this.customStep : this.step;
  }

  private getPageIncrement (): number {
    return this.page > 0 ? this.page : (this.maxValue - this.minValue) / 16;
  }

  private getTrackSize (): number {
    return Math.max(0, this.getAxisSize() - BUTTON_SIZE * 2);
  }

  private getAreaSize (): number {
    return Math.max(0, this.getTrackSize() - MIN_GRABBER_SIZE);
  }

  private getGrabberSize (): number {
    const range = this.maxValue - this.minValue;

    if (range <= 0) {
      return 0;
    }

    return Math.min(this.getTrackSize(), MIN_GRABBER_SIZE + Math.max(0, this.page) / range * this.getAreaSize());
  }

  private getGrabberOffset (): number {
    return this.getAreaSize() * this.getAsRatio();
  }

  private getGrabberRect (): GrabberRect {
    const offset = BUTTON_SIZE + this.getGrabberOffset();
    const size = this.getGrabberSize();

    return this.orientation === Orientation.Horizontal
      ? { x: offset, y: 0, width: size, height: this.height }
      : { x: 0, y: offset, width: this.width, height: size };
  }

  private updateHighlight (position: number): void {
    const total = this.getAxisSize();

    if (position < 0 || position > total) {
      this.highlight = 'none';
    } else if (position < BUTTON_SIZE) {
      this.highlight = 'decrement';
    } else if (position > total - BUTTON_SIZE) {
      this.highlight = 'increment';
    } else {
      this.highlight = 'track';
    }
  }

  override fromData (data: ScrollBarData): void {
    super.fromData(data);
    if (data.customStep !== undefined) {
      this.customStep = data.customStep;
    }
    if (data.trackColor !== undefined) {
      this.trackColor.copyFrom(data.trackColor);
    }
    if (data.buttonColor !== undefined) {
      this.buttonColor.copyFrom(data.buttonColor);
    }
    if (data.buttonActiveColor !== undefined) {
      this.buttonActiveColor.copyFrom(data.buttonActiveColor);
    }
    if (data.grabberColor !== undefined) {
      this.grabberColor.copyFrom(data.grabberColor);
    }
    if (data.grabberHoverColor !== undefined) {
      this.grabberHoverColor.copyFrom(data.grabberHoverColor);
    }
    if (data.grabberPressedColor !== undefined) {
      this.grabberPressedColor.copyFrom(data.grabberPressedColor);
    }
    if (data.arrowColor !== undefined) {
      this.arrowColor.copyFrom(data.arrowColor);
    }
  }
}

@effectsClass('HScrollBar')
export class HScrollBar extends ScrollBar {
  constructor (engine: Engine) {
    super(engine, Orientation.Horizontal);
  }
}

@effectsClass('VScrollBar')
export class VScrollBar extends ScrollBar {
  constructor (engine: Engine) {
    super(engine, Orientation.Vertical);
  }
}
