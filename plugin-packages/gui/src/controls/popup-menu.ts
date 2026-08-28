import {
  EventEmitter,
  MouseButton,
  effectsClass,
  math,
} from '@galacean/effects';
import type {
  EventEmitterListener,
  InputEventKey,
  InputEventMouseButton,
  InputEventMouseMotion,
  Texture,
} from '@galacean/effects';
import type { PopupMenuData } from '../data';
import type { ControlEvent } from '../core/control';
import { Popup } from './popup';

export type PopupMenuItemId = number | string;

export type PopupMenuItem = {
  id: PopupMenuItemId,
  text: string,
  icon?: Texture | null,
  disabled?: boolean,
  separator?: boolean,
  checked?: boolean,
};

export type PopupMenuEvent = ControlEvent & {
  idPressed: [id: PopupMenuItemId],
};

@effectsClass('PopupMenu')
export class PopupMenu extends Popup {
  static override readonly themeType: string = 'PopupMenu';
  private readonly menuEventEmitter = new EventEmitter<PopupMenuEvent>();
  private readonly items: PopupMenuItem[] = [];
  private hoveredIndex = -1;

  override on<E extends keyof PopupMenuEvent> (
    eventName: E,
    listener: EventEmitterListener<PopupMenuEvent[E]>,
  ): void {
    if (eventName === 'idPressed') {
      this.menuEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName as never, listener as never);
    }
  }

  override off<E extends keyof PopupMenuEvent> (
    eventName: E,
    listener: EventEmitterListener<PopupMenuEvent[E]>,
  ): void {
    if (eventName === 'idPressed') {
      this.menuEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName as never, listener as never);
    }
  }

  addItem (text: string, id: PopupMenuItemId = this.items.length, icon: Texture | null = null): void {
    this.items.push({ id, text, icon });
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  addSeparator (text = ''): void {
    this.items.push({ id: `separator-${this.items.length}`, text, separator: true, disabled: true });
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  clear (): void {
    this.items.length = 0;
    this.hoveredIndex = -1;
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  getItemCount (): number { return this.items.length; }
  getItem (index: number): PopupMenuItem | undefined {
    const item = this.items[index];

    return item ? { ...item } : undefined;
  }

  setItemDisabled (index: number, disabled: boolean): void {
    if (this.items[index]) {this.items[index].disabled = disabled;}
  }

  setItemChecked (index: number, checked: boolean): void {
    if (this.items[index]) {this.items[index].checked = checked;}
  }

  override getMinimumSize (): math.Vector2 {
    const panel = this.getThemeStyleBox('panel').getContentMargins();
    const font = this.getThemeFont('font');
    const fontSize = this.getThemeFontSize('fontSize');
    const itemHeight = this.getThemeConstant('itemHeight');
    let width = this.getThemeConstant('horizontalPadding') * 2;
    let height = 0;

    for (const item of this.items) {
      if (item.separator) {
        height += this.getThemeConstant('separatorHeight');
      } else {
        width = Math.max(width, this.measureText(item.text, fontSize, font.family, font.weight, font.style).width
          + this.getThemeConstant('horizontalPadding') * 2 + this.getThemeConstant('iconWidth'));
        height += itemHeight;
      }
    }

    return new math.Vector2(width + panel.left + panel.right, height + panel.top + panel.bottom);
  }

  override getDesiredSize (): math.Vector2 {
    return this.getMinimumSize();
  }

  override draw (): void {
    super.draw();
    const panel = this.getThemeStyleBox('panel').getContentMargins();
    const font = this.getThemeFont('font');
    const fontSize = this.getThemeFontSize('fontSize');
    const itemHeight = this.getThemeConstant('itemHeight');
    const padding = this.getThemeConstant('horizontalPadding');
    const iconWidth = this.getThemeConstant('iconWidth');
    let y = panel.top;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];

      if (item.separator) {
        const height = this.getThemeConstant('separatorHeight');

        this.drawStyleBox(
          this.getThemeStyleBox('separator'), panel.left + padding, y + height * 0.5,
          Math.max(0, this.width - panel.left - panel.right - padding * 2), 1,
        );
        y += height;
        continue;
      }
      if (index === this.hoveredIndex && !item.disabled) {
        this.drawStyleBox(
          this.getThemeStyleBox('hover'), panel.left, y,
          Math.max(0, this.width - panel.left - panel.right), itemHeight,
        );
      }
      if (item.checked) {
        this.drawText(panel.left + padding, y + 2, '✓', fontSize, this.getThemeColor('checkColor'),
          font.family, font.weight, font.style);
      }
      if (item.icon) {
        const iconSize = Math.min(itemHeight - 4, iconWidth);

        this.drawTexture(panel.left + padding, y + (itemHeight - iconSize) * 0.5, iconSize, iconSize, item.icon);
      }
      const measurement = this.measureText(item.text, fontSize, font.family, font.weight, font.style);

      this.drawText(
        panel.left + padding + iconWidth,
        y + (itemHeight - measurement.lineHeight) * 0.5,
        item.text,
        fontSize,
        this.getThemeColor(item.disabled ? 'fontDisabledColor' : 'fontColor'),
        font.family,
        font.weight,
        font.style,
      );
      y += itemHeight;
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    this.hoveredIndex = this.getIndexAt(event.position.y);
  }

  override onMouseLeave (): void {
    this.hoveredIndex = -1;
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {return;}
    const index = this.getIndexAt(event.position.y);

    if (this.activateIndex(index)) {event.accept();}
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'ArrowDown' || event.keycode === 'ArrowUp') {
      this.hoveredIndex = this.findEnabledIndex(this.hoveredIndex, event.keycode === 'ArrowDown' ? 1 : -1);
      event.accept();

      return;
    }
    if (event.keycode === 'Enter' || event.keycode === 'Space' || event.keycode === ' ') {
      if (this.activateIndex(this.hoveredIndex)) {event.accept();}

      return;
    }
    super.onKeyDown(event);
  }

  override onPopupOpened (): void {
    this.hoveredIndex = this.findEnabledIndex(-1, 1);
    super.onPopupOpened();
  }

  private getIndexAt (positionY: number): number {
    const panel = this.getThemeStyleBox('panel').getContentMargins();
    const itemHeight = this.getThemeConstant('itemHeight');
    let y = panel.top;

    for (let index = 0; index < this.items.length; index++) {
      const height = this.items[index].separator ? this.getThemeConstant('separatorHeight') : itemHeight;

      if (positionY >= y && positionY < y + height) {return index;}
      y += height;
    }

    return -1;
  }

  private activateIndex (index: number): boolean {
    const item = this.items[index];

    if (!item || item.disabled || item.separator) {return false;}
    this.menuEventEmitter.emit('idPressed', item.id);
    this.hidePopup();

    return true;
  }

  private findEnabledIndex (origin: number, direction: number): number {
    if (this.items.length === 0) {return -1;}
    let index = origin < 0 && direction < 0 ? this.items.length : origin;

    for (let count = 0; count < this.items.length; count++) {
      index = (index + direction + this.items.length) % this.items.length;
      const item = this.items[index];

      if (!item.disabled && !item.separator) {return index;}
    }

    return -1;
  }

  override fromData (data: PopupMenuData): void {
    super.fromData(data);
    if (data.items !== undefined) {
      this.clear();
      for (const item of data.items) {
        if (item.separator) {
          this.addSeparator(item.text);
        } else {
          this.addItem(item.text, item.id);
          const index = this.items.length - 1;

          this.setItemDisabled(index, item.disabled ?? false);
          this.setItemChecked(index, item.checked ?? false);
        }
      }
    }
  }
}
