import { EventEmitter, effectsClass } from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  InputEventKey,
  math } from '@galacean/effects';
import { FocusMode } from '../core/enums';
import type { Control } from '../core/control';
import { PanelContainer } from '../layout/panel-container';

export type PopupEvent = {
  popupOpened: [],
  popupClosed: [],
};

export abstract class Popup extends PanelContainer {
  static override readonly themeType: string = 'Popup';
  private readonly popupEventEmitter = new EventEmitter<PopupEvent>();

  constructor (engine: Engine) {
    super(engine);
    this.visible = false;
    this.focusMode = FocusMode.All;
  }

  onPopup<E extends keyof PopupEvent> (
    eventName: E,
    listener: EventEmitterListener<PopupEvent[E]>,
  ): void {
    this.popupEventEmitter.on(eventName, listener);
  }

  offPopup<E extends keyof PopupEvent> (
    eventName: E,
    listener: EventEmitterListener<PopupEvent[E]>,
  ): void {
    this.popupEventEmitter.off(eventName, listener);
  }

  popup (position: math.Vector2, source: Control | null = null): void {
    const root = source?.root ?? this.root;

    root?.popupControl(this, source, position);
  }

  hidePopup (): void {
    this.root?.closePopupControl(this);
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') {
      this.hidePopup();
      event.accept();
    }
  }

  override onPopupOpened (): void {
    this.popupEventEmitter.emit('popupOpened');
  }

  override onPopupClosed (): void {
    this.popupEventEmitter.emit('popupClosed');
  }

  override onDestroy (): void {
    this.root?.closePopupControl(this);
  }
}

@effectsClass('PopupPanel')
export class PopupPanel extends Popup {
  static override readonly themeType: string = 'PopupPanel';
}
