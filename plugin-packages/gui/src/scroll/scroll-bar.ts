import {
  EventEmitter,
  MouseButton,
  effectsClass,
  math,
} from '@galacean/effects';
import { FocusMode } from '../core/enums';
import type {
  Engine,
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  spec,
} from '@galacean/effects';
import { Orientation } from '../layout/enums';
import { Range } from './range';
import type { RangeEvent } from './range';

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

const PAGE_DIVISOR = 8;

/** A horizontal or vertical range scroll bar. */
export class ScrollBar extends Range {
  static override readonly themeType: string = 'ScrollBar';
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

  constructor (engine: Engine, orientation = Orientation.Vertical) {
    super(engine);

    this._orientation = orientation;
    this.step = 0;
    this.focusMode = FocusMode.Accessibility;
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
    const decrementSize = this.getButtonAxisSize(false);
    const incrementSize = this.getButtonAxisSize(true);
    const incrementCrossSize = this.getButtonCrossSize(true);
    const scrollMinimum = this.getThemeStyleBox('scroll').getMinimumSize();
    const grabberMinimum = this.getGrabberMinimumSize();

    return this.orientation === Orientation.Horizontal
      ? new math.Vector2(
        decrementSize + incrementSize + scrollMinimum.x + grabberMinimum,
        Math.max(incrementCrossSize, scrollMinimum.y) + this.getCrossStartPadding() + this.getCrossEndPadding(),
      )
      : new math.Vector2(
        Math.max(incrementCrossSize, scrollMinimum.x) + this.getCrossStartPadding() + this.getCrossEndPadding(),
        decrementSize + incrementSize + scrollMinimum.y + grabberMinimum,
      );
  }

  override draw (): void {
    const horizontal = this.orientation === Orientation.Horizontal;
    const axisSize = horizontal ? this.width : this.height;
    const decrementState = this.decrementActive
      ? 'Pressed'
      : this.highlight === 'decrement' ? 'Highlight' : '';
    const incrementState = this.incrementActive
      ? 'Pressed'
      : this.highlight === 'increment' ? 'Highlight' : '';
    const decrementSize = this.getButtonAxisSize(false, decrementState);
    const incrementSize = this.getButtonAxisSize(true, incrementState);
    const trackLength = Math.max(0, axisSize - decrementSize - incrementSize);
    const grabber = this.getGrabberRect();
    const grabberStyle = this.dragging
      ? 'grabberPressed'
      : this.highlight === 'track' ? 'grabberHighlight' : 'grabber';
    const scrollStyle = this.hasFocus(true) ? 'scrollFocus' : 'scroll';

    if (horizontal) {
      this.drawButtonIcon(false, decrementState, 0, 0);
      this.drawStyleBox(this.getThemeStyleBox(scrollStyle), decrementSize, 0, trackLength, this.height);
      this.drawButtonIcon(true, incrementState, axisSize - incrementSize, 0);
    } else {
      this.drawButtonIcon(false, decrementState, 0, 0);
      this.drawStyleBox(this.getThemeStyleBox(scrollStyle), 0, decrementSize, this.width, trackLength);
      this.drawButtonIcon(true, incrementState, 0, axisSize - incrementSize);
    }
    this.drawStyleBox(this.getThemeStyleBox(grabberStyle), grabber.x, grabber.y, grabber.width, grabber.height);
  }

  override onMouseEnter (location: math.Vector2): void {
    this.updateHighlight(this.getAxis(location));
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    const position = this.getAxis(event.position);

    if (this.dragging) {
      const area = this.getAreaSize();

      if (area > 0) {
        const previous = this.value;

        this.setAsRatio(this.dragRatio + (position - this.dragPosition) / area);
        if (previous !== this.value) {
          this.scrollBarEventEmitter.emit('scrolling');
        }
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
    const decrementSize = this.getButtonAxisSize(false);
    const incrementSize = this.getButtonAxisSize(true);
    const trackPosition = position - decrementSize - this.getTrackStartMargin();

    if (position < decrementSize) {
      this.decrementActive = true;
      this.scroll(-this.getIncrement());
    } else if (position > total - incrementSize) {
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
    return Math.max(0, this.getAxisSize() - this.getButtonAxisSize(false) - this.getButtonAxisSize(true));
  }

  private getAreaSize (): number {
    const scrollMinimum = this.getThemeStyleBox('scroll').getMinimumSize();
    const scrollAxisMinimum = this.orientation === Orientation.Horizontal ? scrollMinimum.x : scrollMinimum.y;

    return Math.max(0, this.getTrackSize() - scrollAxisMinimum - this.getGrabberMinimumSize());
  }

  private getGrabberSize (): number {
    const range = this.maxValue - this.minValue;

    if (range <= 0) {
      return 0;
    }

    return Math.min(
      this.getTrackSize(),
      this.getGrabberMinimumSize() + Math.max(0, this.page) / range * this.getAreaSize(),
    );
  }

  private getGrabberMinimumSize (): number {
    const minimum = this.getThemeStyleBox('grabber').getMinimumSize();

    return this.orientation === Orientation.Horizontal ? minimum.x : minimum.y;
  }

  private getGrabberOffset (): number {
    return this.getAreaSize() * this.getAsRatio();
  }

  private getGrabberRect (): GrabberRect {
    const offset = this.getButtonAxisSize(false) + this.getTrackStartMargin() + this.getGrabberOffset();
    const size = this.getGrabberSize();
    const crossStart = this.getCrossStartPadding();
    const crossSize = Math.max(0, (this.orientation === Orientation.Horizontal ? this.height : this.width)
      - crossStart - this.getCrossEndPadding());

    return this.orientation === Orientation.Horizontal
      ? { x: offset, y: crossStart, width: size, height: crossSize }
      : { x: crossStart, y: offset, width: crossSize, height: size };
  }

  private getTrackStartMargin (): number {
    const margins = this.getThemeStyleBox('scroll').getContentMargins();

    return this.orientation === Orientation.Horizontal ? margins.left : margins.top;
  }

  private getCrossStartPadding (): number {
    return Math.max(0, this.getThemeConstant(
      this.orientation === Orientation.Horizontal ? 'paddingTop' : 'paddingLeft',
    ));
  }

  private getCrossEndPadding (): number {
    return Math.max(0, this.getThemeConstant(
      this.orientation === Orientation.Horizontal ? 'paddingBottom' : 'paddingRight',
    ));
  }

  private updateHighlight (position: number): void {
    const total = this.getAxisSize();
    const decrementSize = this.getButtonAxisSize(false);
    const incrementSize = this.getButtonAxisSize(true);

    if (position < 0 || position > total) {
      this.highlight = 'none';
    } else if (position < decrementSize) {
      this.highlight = 'decrement';
    } else if (position > total - incrementSize) {
      this.highlight = 'increment';
    } else {
      this.highlight = 'track';
    }
  }

  private drawButtonIcon (
    increment: boolean,
    state: '' | 'Highlight' | 'Pressed',
    x: number,
    y: number,
  ): void {
    const icon = this.getButtonIcon(increment, state);

    if (icon) {
      this.drawTexture(x, y, icon.width, icon.height, icon);
    }
  }

  private getButtonIcon (increment: boolean, state: '' | 'Highlight' | 'Pressed' = '') {
    const name = increment ? 'increment' : 'decrement';

    return this.getThemeIcon(`${name}${state}`) ?? this.getThemeIcon(name);
  }

  private getButtonAxisSize (increment: boolean, state: '' | 'Highlight' | 'Pressed' = ''): number {
    const icon = this.getButtonIcon(increment, state);

    return icon ? this.orientation === Orientation.Horizontal ? icon.width : icon.height : 0;
  }

  private getButtonCrossSize (increment: boolean): number {
    const icon = this.getButtonIcon(increment);

    return icon ? this.orientation === Orientation.Horizontal ? icon.height : icon.width : 0;
  }

  override fromData (data: spec.ScrollBarData): void {
    super.fromData(data);
    if (data.customStep !== undefined) {
      this.customStep = data.customStep;
    }
  }
}

@effectsClass('HScrollBar')
export class HScrollBar extends ScrollBar {
  static override readonly themeType: string = 'HScrollBar';
  constructor (engine: Engine) {
    super(engine, Orientation.Horizontal);
  }
}

@effectsClass('VScrollBar')
export class VScrollBar extends ScrollBar {
  static override readonly themeType: string = 'VScrollBar';
  constructor (engine: Engine) {
    super(engine, Orientation.Vertical);
  }
}
