import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Button, ButtonDrawMode, Control, HorizontalAlignment, MouseFilter } from '@galacean/effects-plugin-gui';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { EditorIconCache } from './editor-icon-cache';
import type { EditorIcon } from './editor-icon-cache';
import { editorColors } from '../theme/control-theme';

export type { EditorIcon } from './editor-icon-cache';
const caches = new Map<Engine, EditorIconCache>();

export function loadControlIcons (engine: Engine): Promise<void> {
  clearControlIcons(engine); caches.set(engine, new EditorIconCache(engine));

  return Promise.resolve();
}

export function clearControlIcons (engine?: Engine): void {
  if (engine) { caches.get(engine)?.dispose(); caches.delete(engine); } else { caches.forEach(cache => cache.dispose()); caches.clear(); }
}

export function prepareControlIcons (engine: Engine): void { caches.get(engine)?.upload(); }

export function paintIcon (control: Control, icon: EditorIcon, x: number, y: number, dimension = 16, tint = editorColors.foreground): void {
  const cache = caches.get(control.engine);

  if (!cache || dimension <= 0 || !Number.isFinite(dimension)) { return; }
  let a = 1, b = 0, c = 0, d = 1;

  for (let ancestor: Control | null = control; ancestor; ancestor = ancestor.parent) {
    const m = ancestor.getTransform2D().elements;
    const nextA = m[0] * a + m[3] * b, nextB = m[1] * a + m[4] * b;
    const nextC = m[0] * c + m[3] * d;

    d = m[1] * c + m[4] * d; a = nextA; b = nextB; c = nextC;
  }
  const ratio = control.engine.displayServer.pixelRatio;
  const width = Math.round(dimension * Math.hypot(a, b) * ratio), height = Math.round(dimension * Math.hypot(c, d) * ratio);

  if (width < 1 || height < 1) { return; }
  const image = cache.get(icon, width, height);

  if (image.texture && image.region) { control.drawTexture(Math.round(x), Math.round(y), dimension, dimension, image.texture, image.region, tint); }
}

export class EditorIconControl extends Control {
  tint = editorColors.foreground;
  constructor (engine: Engine, public iconName: EditorIcon, public iconSize = 16) {
    super(engine); this.mouseFilter = MouseFilter.Ignore;
    this.setCustomMinimumSize(iconSize, iconSize);
  }
  override draw (): void { paintIcon(this, this.iconName, (this.width - this.iconSize) / 2, (this.height - this.iconSize) / 2, this.iconSize, this.tint); }
}

export class EditorIconButton extends Button {
  iconTint = editorColors.foreground;
  iconSize = 16;
  constructor (engine: Engine, public iconName: EditorIcon, text = '') {
    super(engine, text); this.themeTypeVariation = 'EditorToolbarButton'; this.textAlignment = HorizontalAlignment.Left;
  }
  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();

    return { ...insets, left: insets.left + (this.text ? this.iconSize + 4 : this.iconSize) };
  }
  override getMinimumSize (): math.Vector2 {
    const size = super.getMinimumSize(), insets = this.getNormalContentInsets();

    return new math.Vector2(Math.max(this.iconSize + insets.left + insets.right, size.x), Math.max(this.iconSize + insets.top + insets.bottom, size.y));
  }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const hover = mode === ButtonDrawMode.Hover || mode === ButtonDrawMode.HoverPressed || mode === ButtonDrawMode.Pressed;
    const tint = this.disabled || mode === ButtonDrawMode.Disabled ? editorColors.disabled : hover && this.iconTint === editorColors.foreground ? editorColors.foregroundHover : this.iconTint;
    const insets = super.getContentInsets();

    paintIcon(this, this.iconName, this.text ? this.getNormalContentInsets().left : (this.width - this.iconSize) / 2,
      insets.top + (this.height - insets.top - insets.bottom - this.iconSize) / 2, this.iconSize, tint);
  }
}
