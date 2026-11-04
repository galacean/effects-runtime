import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { ButtonDrawMode } from '@galacean/effects-plugin-gui';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';

export class EditorSelectableRow extends EditorIconButton {
  selected = false;
  constructor (engine: Engine, icon: EditorIcon, text = '') { super(engine, icon, text); this.clipText = true; this.themeTypeVariation = 'EditorListRow'; }
  protected override getContentInsets (): ContentInsets { return { left: 4 + this.iconSize + 5, top: 0, right: 4, bottom: 0 }; }
  override getMinimumSize (): math.Vector2 {
    const font = this.getThemeFont('font');
    const text = this.measureText(this.text, this.getThemeFontSize('fontSize'), font.family, font.weight, font.style);

    return new math.Vector2(0, Math.max(this.iconSize, text.lineHeight));
  }
  override getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) { return ButtonDrawMode.Disabled; }
    const hovered = this.isHovered() || this.isPressing();

    return this.selected ? hovered ? ButtonDrawMode.HoverPressed : ButtonDrawMode.Pressed : hovered ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
  override update (delta: number): void {
    this.setPressedNoSignal(this.selected);
    const variation = this.hasFocus() ? 'EditorListRowActive' : 'EditorListRow';

    if (this.themeTypeVariation !== variation) { this.themeTypeVariation = variation; }
    super.update(delta);
  }
}
