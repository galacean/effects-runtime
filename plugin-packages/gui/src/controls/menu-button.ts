import { EventEmitter, effectsClass, math } from '@galacean/effects';
import type { Engine, EventEmitterListener } from '@galacean/effects';
import type { MenuButtonData, OptionButtonData } from '../data';
import { Button } from './button';
import type { PopupMenuEvent, PopupMenuItemId } from './popup-menu';
import { PopupMenu } from './popup-menu';

@effectsClass('MenuButton')
export class MenuButton extends Button {
  static override readonly themeType: string = 'MenuButton';
  readonly popupMenu: PopupMenu;
  private readonly openMenu = () => this.showPopup();

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.popupMenu = new PopupMenu(engine);
    this.on('pressed', this.openMenu);
  }

  showPopup (): void {
    const transform = this.getGlobalTransform2D().elements;

    this.popupMenu.setSize(Math.max(this.width, this.popupMenu.getBoundDesiredSize().x), this.popupMenu.getBoundDesiredSize().y);
    this.popupMenu.popup(new math.Vector2(transform[6], transform[7] + this.height), this);
  }

  override onDestroy (): void {
    this.off('pressed', this.openMenu);
    this.popupMenu.dispose();
    super.onDestroy();
  }

  override fromData (data: MenuButtonData): void {
    super.fromData(data);
    if (data.items !== undefined) {this.popupMenu.fromData({ items: data.items });}
  }
}

export type OptionButtonEvent = {
  itemSelected: [id: PopupMenuItemId],
};

@effectsClass('OptionButton')
export class OptionButton extends MenuButton {
  static override readonly themeType: string = 'OptionButton';
  private readonly optionEventEmitter = new EventEmitter<OptionButtonEvent>();
  private _selected = -1;
  private readonly menuSelected = (id: PopupMenuItemId) => this.selectId(id, true);

  constructor (engine: Engine) {
    super(engine);
    this.popupMenu.on('idPressed', this.menuSelected as EventEmitterListener<PopupMenuEvent['idPressed']>);
  }

  get selected (): number { return this._selected; }
  set selected (value: number) { this.select(value, false); }

  onOption<E extends keyof OptionButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<OptionButtonEvent[E]>,
  ): void {
    this.optionEventEmitter.on(eventName, listener);
  }

  offOption<E extends keyof OptionButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<OptionButtonEvent[E]>,
  ): void {
    this.optionEventEmitter.off(eventName, listener);
  }

  addItem (text: string, id: PopupMenuItemId = this.popupMenu.getItemCount()): void {
    this.popupMenu.addItem(text, id);
    if (this._selected === -1) {this.select(0, false);}
  }

  clear (): void {
    this.popupMenu.clear();
    this._selected = -1;
    this.text = '';
  }

  select (index: number, signal = true): void {
    const item = this.popupMenu.getItem(index);

    if (!item || item.disabled || item.separator) {return;}
    this._selected = index;
    this.text = item.text;
    if (signal) {this.optionEventEmitter.emit('itemSelected', item.id);}
  }

  selectId (id: PopupMenuItemId, signal = true): void {
    for (let index = 0; index < this.popupMenu.getItemCount(); index++) {
      if (this.popupMenu.getItem(index)?.id === id) {
        this.select(index, signal);

        return;
      }
    }
  }

  override onDestroy (): void {
    this.popupMenu.off('idPressed', this.menuSelected as EventEmitterListener<PopupMenuEvent['idPressed']>);
    super.onDestroy();
  }

  override fromData (data: OptionButtonData): void {
    super.fromData(data);
    if (data.selected !== undefined) {this.select(data.selected, false);}
  }
}
