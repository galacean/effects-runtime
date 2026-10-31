import { Texture, math } from '@galacean/effects';
import type { Engine, TextureRegion } from '@galacean/effects';
import { Button, ButtonDrawMode, Control, HorizontalAlignment, MouseFilter } from '@galacean/effects-plugin-gui';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { EDITOR_ICON_PATHS } from './editor-icon-paths';
import { editorColors } from '../theme/control-theme';

export type EditorIcon = keyof typeof EDITOR_ICON_PATHS;
const names = Object.keys(EDITOR_ICON_PATHS) as EditorIcon[];
const columns = 8, cell = 24, size = 20, gutter = 2;
const rows = Math.ceil(names.length / columns);
let atlas: Texture | undefined;

export async function loadControlIcons (engine: Engine): Promise<void> {
  const source = names.map((key, index) => `<g transform="translate(${index % columns * cell + gutter},${Math.floor(index / columns) * cell + gutter})">${EDITOR_ICON_PATHS[key]}</g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cell * 8}" height="${rows * cell * 8}" viewBox="0 0 ${columns * cell} ${rows * cell}" fill="none">${source}</svg>`;
  const texture = await Texture.fromImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), engine, { flipY: false, name: 'Editor icons' });

  atlas?.dispose(); atlas = texture;
}

export function clearControlIcons (): void { atlas?.dispose(); atlas = undefined; }

export function paintIcon (control: Control, icon: EditorIcon, x: number, y: number, dimension = 16, tint = editorColors.foreground): void {
  if (!atlas || atlas.isDestroyed) { return; }
  const index = names.indexOf(icon);
  const u = index % columns * cell + gutter, v = Math.floor(index / columns) * cell + gutter;
  const region: TextureRegion = { u0: u / (columns * cell), v0: (v + size) / (rows * cell), u1: (u + size) / (columns * cell), v1: v / (rows * cell) };

  control.drawTexture(Math.round(x), Math.round(y), dimension, dimension, atlas, region, tint);
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
    const size = super.getMinimumSize();

    return new math.Vector2(Math.max(this.iconSize + 8, size.x), Math.max(this.iconSize + 8, size.y));
  }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const hover = mode === ButtonDrawMode.Hover || mode === ButtonDrawMode.HoverPressed || mode === ButtonDrawMode.Pressed;
    const tint = this.disabled || mode === ButtonDrawMode.Disabled ? editorColors.disabled : hover && this.iconTint === editorColors.foreground ? editorColors.foregroundHover : this.iconTint;
    const insets = super.getContentInsets();

    paintIcon(this, this.iconName, this.text ? this.getNormalContentInsets().left : (this.width - this.iconSize) / 2,
      insets.top + (this.height - insets.top - insets.bottom - this.iconSize) / 2, this.iconSize, tint);
  }
}
