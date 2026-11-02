import { glContext, math, MouseButton, Texture, TextureSourceType } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Button, Control, VBoxContainer } from '@galacean/effects-plugin-gui';
import { checkerboard } from './checkerboard';
import { editorColors as C } from '../theme/control-theme';
import { append, column, expand, label, row } from './layout';
import { NumberEdit } from './number-edit';
import { EditorDialog } from './dialog';
import { placeCursorWindow } from './cursor-popup';
import { EditorTextField } from './text-field';
import { setTooltip } from './tooltip';

function clamp01 (value: number): number { return Math.max(0, Math.min(1, value)); }

function gradientTexture (engine: Engine, width: number, height: number, data: Uint8Array): Texture {
  const texture = Texture.create(engine, {
    name: 'Color picker gradient', sourceType: TextureSourceType.data, data: { width, height, data }, flipY: false, generateMipmap: false,
    minFilter: glContext.LINEAR, magFilter: glContext.LINEAR, wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
  });

  texture.unregisterObject(); texture.initialize();

  return texture;
}

function toHSV (color: math.Color): { h: number, s: number, v: number } {
  const max = Math.max(color.r, color.g, color.b), min = Math.min(color.r, color.g, color.b), delta = max - min;
  let hue = 0;

  if (delta > 0) {
    hue = (max === color.r ? (color.g - color.b) / delta % 6 : max === color.g ? (color.b - color.r) / delta + 2 : (color.r - color.g) / delta + 4) / 6;
    if (hue < 0) { hue += 1; }
  }

  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function fromHSV (h: number, s: number, v: number, alpha = 1): math.Color {
  const section = Math.floor(h * 6), f = h * 6 - section, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);

  switch (section % 6) {
    case 0: return new math.Color(v, t, p, alpha);
    case 1: return new math.Color(q, v, p, alpha);
    case 2: return new math.Color(p, v, t, alpha);
    case 3: return new math.Color(p, q, v, alpha);
    case 4: return new math.Color(t, p, v, alpha);
    default: return new math.Color(v, p, q, alpha);
  }
}

abstract class ColorPickerArea extends Control {
  private dragging = false;
  protected abstract select (position: math.Vector2): void;
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.dragging = true; this.select(event.position); event.accept(); }
  }
  override onMouseMove (event: InputEventMouseMotion): void { if (this.dragging) { this.select(event.position); event.accept(); } }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.dragging) { this.dragging = false; if (!event.canceled) { this.select(event.position); } event.accept(); }
  }
}

class SaturationValuePlane extends ColorPickerArea {
  private hue = -1;
  private readonly pixels = new Uint8Array([255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  private readonly texture: Texture;
  saturation = 1;
  value = 1;
  changed?: (saturation: number, value: number) => void;
  constructor (engine: Engine) { super(engine); this.setCustomMinimumSize(304, 200); this.texture = gradientTexture(engine, 2, 2, this.pixels); }
  setHue (hue: number): void {
    if (this.hue === hue) { return; }
    this.hue = hue;
    const color = fromHSV(hue, 1, 1);

    this.pixels.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)], 4);
    this.texture.update(this.texture.source);
  }
  override draw (): void {
    this.drawTexture(0, 0, this.width, this.height, this.texture, { u0: .25, v0: .75, u1: .75, v1: .25 });
    const x = clamp01(this.saturation) * this.width, y = (1 - clamp01(this.value)) * this.height;

    this.drawCircle(x, y, 5, C.input, 3); this.drawCircle(x, y, 4, C.foregroundHover, 1);
  }
  protected override select (position: math.Vector2): void { this.changed?.(clamp01(position.x / Math.max(1, this.width)), 1 - clamp01(position.y / Math.max(1, this.height))); }
  override onDestroy (): void { this.texture.dispose(); super.onDestroy(); }
}

class HueBar extends ColorPickerArea {
  value = 0;
  changed?: (hue: number) => void;
  private readonly texture: Texture;
  constructor (engine: Engine) {
    super(engine); this.setCustomMinimumSize(304, 18);
    this.texture = gradientTexture(engine, 7, 1, new Uint8Array([255, 0, 0, 255, 255, 255, 0, 255, 0, 255, 0, 255, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 255, 255, 255, 0, 0, 255]));
  }
  override draw (): void {
    this.drawTexture(0, 0, this.width, this.height, this.texture, { u0: .5 / 7, v0: .5, u1: 6.5 / 7, v1: .5 });
    this.drawLine(this.value * this.width, 0, this.value * this.width, this.height, C.foregroundHover, 2);
  }
  protected override select (position: math.Vector2): void { this.changed?.(clamp01(position.x / Math.max(1, this.width))); }
  override onDestroy (): void { this.texture.dispose(); super.onDestroy(); }
}

class ColorSwatch extends Control {
  constructor (engine: Engine, private readonly read: () => math.Color) { super(engine); this.setCustomMinimumSize(100, 36); }
  override draw (): void { checkerboard(this, 0, 0, this.width, this.height, 8); this.fillRect(0, 0, this.width, this.height, this.read()); }
}

export class EditorColorPicker extends VBoxContainer {
  changed?: (color: math.Color) => void;
  private readonly rgba = new math.Color(1, 1, 1, 1);
  private readonly original = new math.Color(1, 1, 1, 1);
  private readonly plane: SaturationValuePlane;
  private readonly hue: HueBar;
  private readonly channels: NumberEdit[] = [];
  private readonly hex: EditorTextField;
  constructor (engine: Engine) {
    super(engine); this.setThemeConstantOverride('separation', 8);
    const main = append(this, row(engine, [], 16)), spectrum = append(main, column(engine, [], 8)), values = append(main, column(engine, [], 8));

    this.plane = append(spectrum, new SaturationValuePlane(engine)); this.hue = append(spectrum, new HueBar(engine));
    this.plane.changed = (s, v) => this.setColor(fromHSV(this.hue.value, s, v, this.rgba.a), true);
    this.hue.changed = h => {
      const { s, v } = toHSV(this.rgba);

      this.setColor(fromHSV(h, s, v, this.rgba.a), true);
    };
    for (const [i, name] of ['R', 'G', 'B', 'A'].entries()) {
      const line = append(values, row(engine));

      append(line, label(engine, name));
      const field = append(line, new NumberEdit(engine));

      field.axis = i; field.minimum = 0; field.maximum = i === 3 ? 1 : Infinity; field.step = .005; field.setCustomMinimumSize(110, 24);
      field.changed = value => {
        const channels = [this.rgba.r, this.rgba.g, this.rgba.b, this.rgba.a];

        channels[i] = value; this.setColor(new math.Color(channels[0], channels[1], channels[2], channels[3]), true);
      };
      this.channels.push(field);
    }
    append(values, label(engine, 'Hex Linear')); this.hex = append(values, new EditorTextField(engine)); this.hex.placeholderText = '#RRGGBBAA';
    this.hex.on('textSubmitted', value => {
      const text = value.trim().replace(/^#/, '');

      if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(text)) { return; }
      const channels = (text.match(/../g) ?? []).map(channel => Number.parseInt(channel, 16) / 255);

      this.setColor(new math.Color(channels[0], channels[1], channels[2], channels[3] ?? 1), true);
    });
    const swatches = append(this, row(engine, [], 16));

    for (const [name, read] of [['Old', () => this.original], ['New', () => this.rgba]] as const) {
      const swatch = append(swatches, expand(column(engine), true, false));

      append(swatch, label(engine, name)); append(swatch, new ColorSwatch(engine, read));
    }
    this.setColor(this.rgba);
  }
  get color (): math.Color { return this.rgba; }
  set color (value: math.Color) { this.original.copyFrom(value); this.setColor(value); }
  private setColor (color: math.Color, signal = false): void {
    this.rgba.copyFrom(color);
    const hsv = toHSV(color), channels = [color.r, color.g, color.b, color.a];

    this.plane.setHue(hsv.h); this.plane.saturation = hsv.s; this.plane.value = hsv.v; this.hue.value = hsv.h;
    this.channels.forEach((field, i) => { if (!field.isEditing) { field.value = channels[i]; } });
    if (!this.hex.hasFocus()) { this.hex.text = '#' + channels.map(value => Math.round(clamp01(value) * 255).toString(16).padStart(2, '0').toUpperCase()).join(''); }
    if (signal) { this.changed?.(color.clone()); }
  }
}

export class EditorColorButton extends Button {
  changed?: (color: math.Color) => void;
  finished?: () => void;
  private readonly rgba = new math.Color(1, 1, 1, 1);
  private readonly popup: EditorDialog;
  constructor (engine: Engine) {
    super(engine, ''); this.popup = new EditorDialog(engine);
    this.on('pressed', () => {
      const original = this.rgba.clone();

      this.popup.show(this, 'Color Picker', body => {
        const picker = append(body, new EditorColorPicker(engine));

        picker.color = original; picker.changed = color => { this.rgba.copyFrom(color); this.changed?.(color); };
      }, [
        { label: 'OK', primary: true, action: () => this.popup.close() },
        { label: 'Cancel', action: () => { this.rgba.copyFrom(original); this.changed?.(original.clone()); this.popup.close(); } },
      ], 500);
      placeCursorWindow(this.popup);
    });
    this.popup.onPopup('popupClosed', () => this.finished?.()); setTooltip(this, 'Choose a color');
  }
  get color (): math.Color { return this.rgba; }
  set color (value: math.Color) { if (!this.popup.visible) { this.rgba.copyFrom(value); } }
  protected override drawDecoration (): void {
    if (this.width <= 6 || this.height <= 6) { return; }
    checkerboard(this, 3, 3, this.width - 6, this.height - 6, 8); this.fillRect(3, 3, this.width - 6, this.height - 6, this.rgba);
  }
  override onDestroy (): void { this.popup.dispose(); super.onDestroy(); }
}
