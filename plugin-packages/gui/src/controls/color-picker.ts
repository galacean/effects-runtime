import {
  EventEmitter,
  MouseButton,
  effectsClass,
  math,
} from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  InputEventMouseButton,
  InputEventMouseMotion,
} from '@galacean/effects';
import type { ColorPickerButtonData, ColorPickerData } from '../data';
import { Control, SizeFlags } from '../core/control';
import type { ControlEvent } from '../core/control';
import { MouseFilter } from '../core/enums';
import { GridContainer } from '../layout/grid-container';
import { VBoxContainer } from '../layout/box-container';
import { HSlider } from './slider';
import { Label } from './label';
import { LineEdit } from './line-edit';
import { PopupPanel } from './popup';
import { Button } from './button';
import type { ContentInsets } from './button';
import type { ButtonDrawMode } from './enums';
import type { BaseButtonEvent } from './base-button';

type HSV = { h: number, s: number, v: number };

export type ColorPickerEvent = ControlEvent & {
  colorChanged: [color: math.Color],
};

export type ColorPickerButtonEvent = BaseButtonEvent & {
  colorChanged: [color: math.Color],
};

class ColorPlane extends Control {
  hue = 0;
  saturation = 1;
  value = 1;
  changed?: (saturation: number, value: number) => void;
  private dragging = false;

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
    this.setCustomMinimumSize(180, 120);
  }

  override draw (): void {
    const columns = 20;
    const rows = 12;

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const saturation = column / (columns - 1);
        const value = 1 - row / (rows - 1);

        this.fillRect(
          column * this.width / columns,
          row * this.height / rows,
          this.width / columns + 1,
          this.height / rows + 1,
          hsvToColor(this.hue, saturation, value, 1),
        );
      }
    }
    const x = this.saturation * this.width;
    const y = (1 - this.value) * this.height;

    this.drawCircle(x, y, 5, new math.Color(0, 0, 0, 1), 3);
    this.drawCircle(x, y, 4, new math.Color(1, 1, 1, 1), 1);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.dragging = true;
      this.updateValue(event.position);
      event.accept();
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.dragging) {
      this.updateValue(event.position);
      event.accept();
    }
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.dragging) {
      this.dragging = false;
      this.updateValue(event.position);
      event.accept();
    }
  }

  private updateValue (position: math.Vector2): void {
    this.saturation = clamp01(position.x / Math.max(1, this.width));
    this.value = 1 - clamp01(position.y / Math.max(1, this.height));
    this.changed?.(this.saturation, this.value);
  }
}

class HueBar extends Control {
  value = 0;
  changed?: (value: number) => void;
  private dragging = false;

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
    this.setCustomMinimumSize(180, 18);
  }

  override draw (): void {
    const count = 24;

    for (let index = 0; index < count; index++) {
      this.fillRect(
        index * this.width / count, 0, this.width / count + 1, this.height,
        hsvToColor(index / (count - 1), 1, 1, 1),
      );
    }
    this.drawLine(this.value * this.width, 0, this.value * this.width, this.height,
      new math.Color(1, 1, 1, 1), 2);
  }

  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) {
      this.dragging = true;
      this.updateValue(event.position.x);
      event.accept();
    }
  }

  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.dragging) {
      this.updateValue(event.position.x);
      event.accept();
    }
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.dragging) {
      this.dragging = false;
      this.updateValue(event.position.x);
      event.accept();
    }
  }

  private updateValue (position: number): void {
    this.value = clamp01(position / Math.max(1, this.width));
    this.changed?.(this.value);
  }
}

@effectsClass('ColorPicker')
export class ColorPicker extends VBoxContainer {
  static override readonly themeType: string = 'ColorPicker';
  private readonly colorEventEmitter = new EventEmitter<ColorPickerEvent>();
  private readonly plane: ColorPlane;
  private readonly hueBar: HueBar;
  private readonly alphaSlider: HSlider;
  private readonly channelFields: LineEdit[] = [];
  private readonly hexField: LineEdit;
  private readonly currentColor = new math.Color(1, 1, 1, 1);
  private syncing = false;
  private _editAlpha = true;

  constructor (engine: Engine) {
    super(engine);
    this.setThemeConstantOverride('separation', 6);
    this.plane = new ColorPlane(engine);
    this.plane.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.ExpandFill);
    this.plane.parent = this;
    this.hueBar = new HueBar(engine);
    this.hueBar.setSizeFlags(SizeFlags.ExpandFill, SizeFlags.Fill);
    this.hueBar.parent = this;
    this.alphaSlider = new HSlider(engine);
    this.alphaSlider.minValue = 0;
    this.alphaSlider.maxValue = 1;
    this.alphaSlider.step = 0.01;
    this.alphaSlider.setCustomMinimumSize(180, 18);
    this.alphaSlider.parent = this;
    const channels = new GridContainer(engine);

    channels.columns = 4;
    channels.setThemeConstantOverride('horizontalSeparation', 4);
    channels.setThemeConstantOverride('verticalSeparation', 4);
    channels.parent = this;
    for (const name of ['R', 'G', 'B', 'A']) {
      const index = this.channelFields.length;
      const row = new VBoxContainer(engine);
      const label = new Label(engine, name);
      const field = new LineEdit(engine);

      row.setThemeConstantOverride('separation', 2);
      label.parent = row;
      field.parent = row;
      row.parent = channels;
      field.on('textSubmitted', value => this.submitChannel(index, value));
      this.channelFields.push(field);
    }
    this.hexField = new LineEdit(engine);
    this.hexField.placeholderText = '#RRGGBBAA';
    this.hexField.parent = this;
    this.hexField.on('textSubmitted', value => this.submitHex(value));
    this.plane.changed = (saturation, value) => {
      const hsv = colorToHsv(this.currentColor);

      this.setColor(hsvToColor(hsv.h, saturation, value, this.currentColor.a), true);
    };
    this.hueBar.changed = hue => {
      const hsv = colorToHsv(this.currentColor);

      this.setColor(hsvToColor(hue, hsv.s, hsv.v, this.currentColor.a), true);
    };
    this.alphaSlider.on('valueChanged', value => {
      if (!this.syncing) {
        this.setColor(new math.Color(this.currentColor.r, this.currentColor.g, this.currentColor.b, value), true);
      }
    });
    this.syncEditors();
  }

  get color (): math.Color { return this.currentColor.clone(); }
  set color (value: math.Color) { this.setColor(value, false); }
  get editAlpha (): boolean { return this._editAlpha; }
  set editAlpha (value: boolean) {
    if (this._editAlpha !== value) {
      this._editAlpha = value;
      this.syncEditors();
    }
  }

  override on<E extends keyof ColorPickerEvent> (
    eventName: E,
    listener: EventEmitterListener<ColorPickerEvent[E]>,
  ): void {
    if (eventName === 'colorChanged') {
      this.colorEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof ColorPickerEvent> (
    eventName: E,
    listener: EventEmitterListener<ColorPickerEvent[E]>,
  ): void {
    if (eventName === 'colorChanged') {
      this.colorEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  setColor (value: math.Color, signal = false): void {
    if (this.currentColor.equals(value)) {return;}
    this.currentColor.copyFrom(value);
    this.syncEditors();
    if (signal) {this.colorEventEmitter.emit('colorChanged', this.currentColor.clone());}
  }

  private syncEditors (): void {
    this.syncing = true;
    const hsv = colorToHsv(this.currentColor);

    this.plane.hue = hsv.h;
    this.plane.saturation = hsv.s;
    this.plane.value = hsv.v;
    this.hueBar.value = hsv.h;
    this.alphaSlider.setValueNoSignal(this.currentColor.a);
    const values = [this.currentColor.r, this.currentColor.g, this.currentColor.b, this.currentColor.a];

    for (let index = 0; index < this.channelFields.length; index++) {
      this.channelFields[index].text = String(Math.round(values[index] * 255));
      this.channelFields[index].editable = index < 3 || this._editAlpha;
    }
    this.hexField.text = colorToHex(this.currentColor, this._editAlpha);
    this.alphaSlider.visible = this._editAlpha;
    this.syncing = false;
  }

  private submitChannel (index: number, value: string): void {
    const number = Number(value);

    if (!Number.isFinite(number)) {return;}
    const channels = [this.currentColor.r, this.currentColor.g, this.currentColor.b, this.currentColor.a];

    channels[index] = clamp01(number / 255);
    this.setColor(new math.Color(channels[0], channels[1], channels[2], channels[3]), true);
  }

  private submitHex (value: string): void {
    const parsed = colorFromHex(value, 1);

    if (parsed) {
      if (!this._editAlpha) {parsed.a = this.currentColor.a;}
      this.setColor(parsed, true);
    }
  }

  override fromData (data: ColorPickerData): void {
    super.fromData(data);
    if (data.color !== undefined) {
      this.currentColor.copyFrom(data.color);
      this.syncEditors();
    }
    if (data.editAlpha !== undefined) {
      this.editAlpha = data.editAlpha;
      this.syncEditors();
    }
  }
}

@effectsClass('ColorPickerButton')
export class ColorPickerButton extends Button {
  static override readonly themeType: string = 'ColorPickerButton';
  readonly picker: ColorPicker;
  readonly popupPanel: PopupPanel;
  private readonly colorEventEmitter = new EventEmitter<ColorPickerButtonEvent>();
  private readonly openPicker = () => this.showPicker();

  constructor (engine: Engine) {
    super(engine);
    this.popupPanel = new PopupPanel(engine);
    this.picker = new ColorPicker(engine);
    this.picker.setCustomMinimumSize(250, 330);
    this.picker.parent = this.popupPanel;
    this.picker.on('colorChanged', color => this.colorEventEmitter.emit('colorChanged', color));
    this.on('pressed', this.openPicker);
  }

  get color (): math.Color { return this.picker.color; }
  set color (value: math.Color) { this.picker.color = value; }
  get editAlpha (): boolean { return this.picker.editAlpha; }
  set editAlpha (value: boolean) {
    this.picker.editAlpha = value;
  }

  override on<E extends keyof ColorPickerButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<ColorPickerButtonEvent[E]>,
  ): void {
    if (eventName === 'colorChanged') {
      this.colorEventEmitter.on(eventName, listener);
    } else {
      super.on(eventName, listener as never);
    }
  }

  override off<E extends keyof ColorPickerButtonEvent> (
    eventName: E,
    listener: EventEmitterListener<ColorPickerButtonEvent[E]>,
  ): void {
    if (eventName === 'colorChanged') {
      this.colorEventEmitter.off(eventName, listener);
    } else {
      super.off(eventName, listener as never);
    }
  }

  showPicker (): void {
    const transform = this.getGlobalTransform2D().elements;

    this.popupPanel.setSize(270, 350);
    this.popupPanel.popup(new math.Vector2(transform[6], transform[7] + this.height), this);
  }

  protected override getContentInsets (): ContentInsets {
    const base = super.getContentInsets();

    return { ...base, left: base.left + Math.max(18, this.height - base.top - base.bottom) + 6 };
  }

  protected override drawDecoration (_mode: ButtonDrawMode): void {
    const margins = this.getNormalContentInsets();
    const size = Math.max(12, this.height - margins.top - margins.bottom);

    this.fillRect(margins.left, (this.height - size) * 0.5, size, size, this.picker.color);
    this.drawRect(margins.left + 0.5, (this.height - size) * 0.5 + 0.5, size - 1, size - 1,
      this.getThemeColor('swatchBorderColor'), 1);
  }

  override onDestroy (): void {
    this.off('pressed', this.openPicker);
    this.popupPanel.dispose();
    super.onDestroy();
  }

  override fromData (data: ColorPickerButtonData): void {
    super.fromData(data);
    if (data.color !== undefined) {this.picker.fromData({ color: data.color });}
    if (data.editAlpha !== undefined) {this.editAlpha = data.editAlpha;}
  }
}

function clamp01 (value: number): number {
  return Math.max(0, Math.min(1, value));
}

function colorToHsv (color: math.Color): HSV {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === color.r) {hue = ((color.g - color.b) / delta) % 6;} else if (max === color.g) {hue = (color.b - color.r) / delta + 2;} else {hue = (color.r - color.g) / delta + 4;}
    hue /= 6;
    if (hue < 0) {hue += 1;}
  }

  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToColor (hue: number, saturation: number, value: number, alpha: number): math.Color {
  const section = Math.floor(hue * 6);
  const fraction = hue * 6 - section;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);

  switch (section % 6) {
    case 0: return new math.Color(value, t, p, alpha);
    case 1: return new math.Color(q, value, p, alpha);
    case 2: return new math.Color(p, value, t, alpha);
    case 3: return new math.Color(p, q, value, alpha);
    case 4: return new math.Color(t, p, value, alpha);
    default: return new math.Color(value, p, q, alpha);
  }
}

function colorToHex (color: math.Color, alpha: boolean): string {
  const values = [color.r, color.g, color.b, color.a].map(value => {
    return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0').toUpperCase();
  });

  return `#${values.slice(0, alpha ? 4 : 3).join('')}`;
}

function colorFromHex (value: string, fallbackAlpha: number): math.Color | null {
  const source = value.trim().replace('#', '');

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(source)) {return null;}
  const number = Number.parseInt(source, 16);
  const hasAlpha = source.length === 8;

  return new math.Color(
    ((number >> (hasAlpha ? 24 : 16)) & 0xff) / 255,
    ((number >> (hasAlpha ? 16 : 8)) & 0xff) / 255,
    ((number >> (hasAlpha ? 8 : 0)) & 0xff) / 255,
    hasAlpha ? (number & 0xff) / 255 : fallbackAlpha,
  );
}
