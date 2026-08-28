import { EventEmitter, effectsClass, math } from '@galacean/effects';
import type { Engine, EventEmitterListener } from '@galacean/effects';
import { FocusMode } from '../core/enums';
import type { MenuButtonData, OptionButtonData } from '../data';
import { Button } from './button';
import type { ContentInsets } from './button';
import { ButtonDrawMode, HorizontalAlignment } from './enums';
import type { PopupMenuEvent, PopupMenuItemId } from './popup-menu';
import { PopupMenu } from './popup-menu';

const OPTION_ARROW_GRID_SIZE = 12;

@effectsClass('MenuButton')
export class MenuButton extends Button {
  static override readonly themeType: string = 'MenuButton';
  readonly popupMenu: PopupMenu;
  private readonly openMenu = () => this.showPopup();

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.focusMode = FocusMode.Accessibility;
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
    this.focusMode = FocusMode.All;
    this.textAlignment = HorizontalAlignment.Left;
    this.popupMenu.on('idPressed', this.menuSelected as EventEmitterListener<PopupMenuEvent['idPressed']>);
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();
    const arrow = this.getThemeIcon('arrow');
    const arrowWidth = arrow?.width ?? this.getThemeConstant('arrowSize');

    return {
      ...insets,
      right: insets.right + arrowWidth + Math.max(0, this.getThemeConstant('hSeparation')),
    };
  }

  protected override drawDecoration (mode: ButtonDrawMode): void {
    const arrow = this.getThemeIcon('arrow');
    const size = arrow?.width ?? this.getThemeConstant('arrowSize');
    const height = arrow?.height ?? size;
    const margin = this.getThemeConstant('arrowMargin');
    const x = Math.max(0, this.width - margin - size);
    const y = Math.floor(Math.abs(this.height - height) * 0.5);
    const color = this.getArrowColor(mode);

    if (arrow) {
      this.drawTexture(x, y, size, height, arrow, undefined, color);

      return;
    }
    const scale = size / OPTION_ARROW_GRID_SIZE;
    const startX = x + 2 * scale;
    const startY = y + 4 * scale;
    const middleX = x + 6 * scale;
    const middleY = y + 8 * scale;
    const endX = x + 10 * scale;
    const thickness = 2 * scale;
    const radius = thickness * 0.5;

    this.drawLine(startX, startY, middleX, middleY, color, thickness);
    this.drawLine(middleX, middleY, endX, startY, color, thickness);
    this.fillCircle(startX, startY, radius, color);
    this.fillCircle(middleX, middleY, radius, color);
    this.fillCircle(endX, startY, radius, color);
  }

  private getArrowColor (mode: ButtonDrawMode): math.Color {
    if (this.getThemeConstant('modulateArrow') === 0) {
      return this.getThemeColor('iconTint');
    }
    switch (mode) {
      case ButtonDrawMode.Pressed: return this.getThemeColor('fontPressedColor');
      case ButtonDrawMode.Hover: return this.getThemeColor('fontHoverColor');
      case ButtonDrawMode.HoverPressed: return this.getThemeColor('fontHoverPressedColor');
      case ButtonDrawMode.Disabled: return this.getThemeColor('fontDisabledColor');
      default: return this.hasFocus(true)
        ? this.getThemeColor('fontFocusColor')
        : this.getThemeColor('fontColor');
    }
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
