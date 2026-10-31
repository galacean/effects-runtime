import type { math } from '@galacean/effects';
import { LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import { editorColors } from '../theme/control-theme';

export class EditorTextField extends LineEdit {
  private hovered = false;
  override onLostFocus (): void { super.onLostFocus(); this.deselect(); }
  override onMouseEnter (position: math.Vector2): void { super.onMouseEnter(position); this.hovered = true; }
  override onMouseLeave (): void { super.onMouseLeave(); this.hovered = false; }
  protected override getTextColor (): math.Color { return this.editable && this.hasFocus() && this.text ? editorColors.foregroundHover : super.getTextColor(); }
  protected override drawSelection (x: number, y: number, width: number, height: number): void { if (this.hasFocus()) { super.drawSelection(x, y, width, height); } }
  protected override drawTextBackground (): void {
    super.drawTextBackground();
    if (this.hasFocus() && !this.hasFocus(true)) { this.drawStyleBox(this.getThemeStyleBox('focus'), 0, 0, this.width, this.height); }
    if (this.editable && this.hovered && !this.hasFocus()) { this.drawStyleBox(this.getThemeStyleBox('hover'), 0, 0, this.width, this.height); }
  }
}

export class EditorTextArea extends TextEdit {
  private hovered = false;
  override onLostFocus (): void { super.onLostFocus(); this.deselect(); }
  override onMouseEnter (position: math.Vector2): void { super.onMouseEnter(position); this.hovered = true; }
  override onMouseLeave (): void { super.onMouseLeave(); this.hovered = false; }
  protected override getTextColor (): math.Color { return this.editable && this.hasFocus() && this.text ? editorColors.foregroundHover : super.getTextColor(); }
  protected override drawSelection (x: number, y: number, width: number, height: number): void { if (this.hasFocus()) { super.drawSelection(x, y, width, height); } }
  protected override drawTextBackground (): void {
    super.drawTextBackground();
    if (this.hasFocus() && !this.hasFocus(true)) { this.drawStyleBox(this.getThemeStyleBox('focus'), 0, 0, this.width, this.height); }
    if (this.editable && this.hovered && !this.hasFocus()) { this.drawStyleBox(this.getThemeStyleBox('hover'), 0, 0, this.width, this.height); }
  }
}
