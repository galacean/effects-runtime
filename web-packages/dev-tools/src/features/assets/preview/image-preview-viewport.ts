import { math, MouseButton, MouseButtonMask } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Button, ButtonDrawMode, Control, FocusMode, VBoxContainer } from '@galacean/effects-plugin-gui';
import { append, expand, row } from '../../../ui/controls/layout';
import { EditorMenuButton } from '../../../ui/controls/menu';
import { checkerboard } from '../../../ui/asset-view/asset-view';
import { editorBox, editorColors as C, EDITOR_FONT } from '../../../ui/theme/control-theme';
import { setTooltip } from '../../../ui/controls/tooltip';
import { TexturePresentation, type TextureDisplay, type TexturePreview } from './texture-preview';

export interface PreviewImage { preview: TexturePreview, width: number, height: number }
export interface ImagePreviewRect { x: number, y: number, width: number, height: number }

class TextureChannelButton extends Button {
  constructor (engine: Engine, channel: number, private readonly display: TextureDisplay) {
    super(engine, 'RGBA'[channel]); this.toggleMode = true;
    const color = new math.Color(channel === 0 || channel === 3 ? 1 : 0, channel === 1 || channel === 3 ? 1 : 0, channel === 2 || channel === 3 ? 1 : 0, 1);
    const off = editorBox(C.dropdown, 0, 3), hover = editorBox(C.hover, 0, 3);

    const checked = editorBox(new math.Color(color.r, color.g, color.b, .8), 0, 3), checkedHover = editorBox(color, 0, 3);

    for (const box of [off, hover, checked, checkedHover]) { box.setContentMargins(8, 4, 8, 4); }
    this.setThemeStyleBoxOverride('normal', off); this.setThemeStyleBoxOverride('hover', hover);
    this.setThemeStyleBoxOverride('pressed', checked); this.setThemeStyleBoxOverride('hoverPressed', checkedHover);
    this.setThemeFontOverride('font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' }); this.setThemeFontSizeOverride('fontSize', 16);
    this.setThemeStyleBoxOverride('focus', editorBox(C.clear, 0, 3, C.primary));
    this.on('toggled', pressed => { this.display.channels[channel] = pressed ? 1 : 0; this.refreshColors(); });
    setTooltip(this, ['Red Channel', 'Green Channel', 'Blue Channel', 'Alpha Channel'][channel]);
    this.setPressedNoSignal(!!display.channels[channel]); this.refreshColors();
  }
  override getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) { return ButtonDrawMode.Disabled; }
    const hovered = this.isHovered() || this.isPressing();

    return this.buttonPressed ? hovered ? ButtonDrawMode.HoverPressed : ButtonDrawMode.Pressed : hovered ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
  private refreshColors (): void {
    const foreground = this.buttonPressed ? new math.Color(0, 0, 0, 1) : C.foreground;

    for (const state of ['fontColor', 'fontFocusColor', 'fontHoverColor', 'fontPressedColor', 'fontHoverPressedColor']) { this.setThemeColorOverride(state, foreground); }
  }
}

export class ImagePreviewViewport extends VBoxContainer {
  fit = true;
  zoom = 1;
  offset = new math.Vector2();
  readonly display: TextureDisplay = { channels: [1, 1, 1, 1], desaturate: false };
  background: 'checker' | 'dark' | 'light' = 'checker';
  border = true;
  source: () => PreviewImage | undefined = () => undefined;
  overlay?: (canvas: Control, rect: ImagePreviewRect) => void;
  readonly canvas: ImageCanvas;
  private readonly zoomButton: EditorMenuButton;

  constructor (engine: Engine) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    const toolbar = append(this, row(engine));

    for (let channel = 0; channel < 4; channel++) {
      append(toolbar, new TextureChannelButton(engine, channel, this.display));
    }
    this.zoomButton = append(toolbar, new EditorMenuButton(engine, 'Fit')); this.zoomButton.showArrow = true;
    this.zoomButton.actions = () => [{ label: 'Fit', shortcut: 'F', checked: this.fit, action: () => this.reset() },
      ...[25, 50, 100, 200, 400].map(percent => ({ label: percent + '%', checked: !this.fit && Math.abs(this.zoom * 100 - percent) < .1,
        action: () => { this.fit = false; this.zoom = percent / 100; this.offset.set(0, 0); } }))];
    const options = append(toolbar, new EditorMenuButton(engine, 'View'));

    options.iconName = 'view'; options.showArrow = true;
    options.actions = () => [
      { label: 'Desaturate', checked: this.display.desaturate, action: () => this.display.desaturate = !this.display.desaturate },
      { label: 'Draw Border', checked: this.border, action: () => this.border = !this.border },
      ...(['checker', 'dark', 'light'] as const).map(value => ({ label: value === 'checker' ? 'Checkered' : value === 'dark' ? 'Dark' : 'Light',
        checked: this.background === value, action: () => this.background = value })),
    ];
    this.canvas = append(this, expand(new ImageCanvas(engine, this)));
  }
  reset (): void { this.fit = true; this.offset.set(0, 0); }
  override update (dt: number): void { this.zoomButton.text = this.fit ? 'Fit' : Math.round(this.zoom * 100) + '%'; super.update(dt); }
}

class ImageCanvas extends Control {
  private image?: PreviewImage;
  private readonly presentation: TexturePresentation;
  constructor (engine: Engine, private readonly viewport: ImagePreviewViewport) {
    super(engine); this.focusMode = FocusMode.All; this.presentation = new TexturePresentation(engine);
  }
  override update (dt: number): void {
    if (this.visibleInHierarchy) {
      this.image = this.viewport.source();
      this.presentation.update(this.image?.preview, this.viewport.display);
      if (this.image && this.viewport.fit) {
        this.viewport.zoom = Math.max(.01, Math.min((this.width - 48) / this.image.width, (this.height - 48) / this.image.height));
        this.viewport.offset.set(0, 0);
      }
    }
    super.update(dt);
  }
  override draw (): void {
    const v = this.viewport, image = this.image, graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(0, 0, this.width, this.height); this.fillRect(0, 0, this.width, this.height, C.background);
    if (image) {
      const width = image.width * v.zoom, height = image.height * v.zoom;
      const x = (this.width - width) / 2 + v.offset.x, y = (this.height - height) / 2 + v.offset.y;

      if (v.background === 'checker') {
        const left = Math.max(0, x), top = Math.max(0, y);

        checkerboard(this, left, top, Math.max(0, Math.min(this.width, x + width) - left), Math.max(0, Math.min(this.height, y + height) - top), 12);
      } else { this.fillRect(x, y, width, height, v.background === 'dark' ? C.background : new math.Color(.7, .7, .7, 1)); }
      this.presentation.draw(this, x, y, width, height);
      if (v.border) { this.drawRect(x, y, width, height, C.foreground); }
      v.overlay?.(this, { x, y, width, height });
    } else { this.drawText(16, 16, 'Loading image...', 14, C.muted, EDITOR_FONT); }
    graphics.popClipRect();
  }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus();
    if (event.doubleClick && event.buttonIndex === MouseButton.Left) { this.viewport.reset(); }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (event.buttonMask & (MouseButtonMask.Middle | MouseButtonMask.Right)) { this.viewport.fit = false; this.viewport.offset.add(event.relative); event.accept(); }
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    const v = this.viewport, zoom = Math.max(.01, Math.min(32, v.zoom * Math.pow(1.18, event.factor * (event.buttonIndex === MouseButton.WheelUp ? 1 : -1))));
    const x = event.position.x - this.width / 2, y = event.position.y - this.height / 2;

    v.offset.x = x - (x - v.offset.x) * zoom / v.zoom; v.offset.y = y - (y - v.offset.y) * zoom / v.zoom;
    v.zoom = zoom; v.fit = false; event.accept();
  }
  override onKeyDown (event: InputEventKey): void { if (event.physicalKeycode === 'KeyF') { this.viewport.reset(); event.accept(); } }
  override onDestroy (): void { this.presentation.dispose(); super.onDestroy(); }
}
