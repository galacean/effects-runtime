import type { math } from '@galacean/effects';
import { LineEdit, TextEdit } from '@galacean/effects-plugin-gui';
import { editorColors } from '../theme/control-theme';

class EditorTextCaret {
  private elapsed = 0;
  get visible (): boolean { return this.elapsed < .5; }
  reset (): void { this.elapsed = 0; }
  update (delta: number, focused: boolean): void { this.elapsed = focused ? (this.elapsed + Math.max(0, delta)) % 1 : 0; }
}

export class EditorTextField extends LineEdit {
  private hovered = false;
  private readonly caret = new EditorTextCaret();
  override update (delta: number): void { super.update(delta); this.caret.update(delta, this.hasFocus()); }
  override onGotFocus (): void { this.caret.reset(); super.onGotFocus(); }
  override onLostFocus (): void { super.onLostFocus(); this.deselect(); }
  override setSelection (start: number, end = start): void { super.setSelection(start, end); this.caret?.reset(); }
  override onMouseEnter (position: math.Vector2): void { super.onMouseEnter(position); this.hovered = true; }
  override onMouseLeave (): void { super.onMouseLeave(); this.hovered = false; }
  protected override onTextValueChanged (): void { super.onTextValueChanged(); this.caret?.reset(); }
  protected override drawCaret (x: number, y: number, height: number): void { if (this.caret.visible) { super.drawCaret(x, y, height); } }
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
  private readonly caret = new EditorTextCaret();
  override update (delta: number): void { super.update(delta); this.caret.update(delta, this.hasFocus()); }
  override onGotFocus (): void { this.caret.reset(); super.onGotFocus(); }
  override onLostFocus (): void { super.onLostFocus(); this.deselect(); }
  override setSelection (start: number, end = start): void { super.setSelection(start, end); this.caret?.reset(); }
  override onMouseEnter (position: math.Vector2): void { super.onMouseEnter(position); this.hovered = true; }
  override onMouseLeave (): void { super.onMouseLeave(); this.hovered = false; }
  protected override onTextValueChanged (): void { super.onTextValueChanged(); this.caret?.reset(); }
  protected override drawCaret (x: number, y: number, height: number): void { if (this.caret.visible) { super.drawCaret(x, y, height); } }
  protected override getTextColor (): math.Color { return this.editable && this.hasFocus() && this.text ? editorColors.foregroundHover : super.getTextColor(); }
  protected override drawSelection (x: number, y: number, width: number, height: number): void { if (this.hasFocus()) { super.drawSelection(x, y, width, height); } }
  protected override drawTextBackground (): void {
    super.drawTextBackground();
    if (this.hasFocus() && !this.hasFocus(true)) { this.drawStyleBox(this.getThemeStyleBox('focus'), 0, 0, this.width, this.height); }
    if (this.editable && this.hovered && !this.hasFocus()) { this.drawStyleBox(this.getThemeStyleBox('hover'), 0, 0, this.width, this.height); }
  }
}
