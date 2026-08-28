import { effectsClass, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { LineEditData } from '../data';
import { HorizontalAlignment } from './enums';
import { TextInput } from './text-input';

@effectsClass('LineEdit')
export class LineEdit extends TextInput {
  static override readonly themeType: string = 'LineEdit';
  protected readonly multiline = false;
  secret = false;
  alignment = HorizontalAlignment.Left;
  private scrollOffset = 0;
  private _secretCharacter = '•';

  constructor (engine: Engine, text = '') {
    super(engine);
    this.text = text;
  }

  get secretCharacter (): string { return this._secretCharacter; }
  set secretCharacter (value: string) {
    const character = Array.from(value)[0] ?? '';

    if (this._secretCharacter !== character) {
      this._secretCharacter = character;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
  }

  override getMinimumSize (): math.Vector2 {
    const style = this.getTextStyleBox();
    const margins = style.getContentMargins();
    const font = this.getTextFont();
    const measurement = this.measureText('M', this.getTextFontSize(), font.family, font.weight, font.style);

    return new math.Vector2(margins.left + margins.right + 24, margins.top + margins.bottom + measurement.lineHeight);
  }

  override getDesiredSize (): math.Vector2 {
    const style = this.getTextStyleBox();
    const margins = style.getContentMargins();
    const font = this.getTextFont();
    const display = this.getVisibleText() || this.placeholderText;
    const measurement = this.measureText(display, this.getTextFontSize(), font.family, font.weight, font.style);

    return new math.Vector2(
      margins.left + margins.right + measurement.width,
      margins.top + margins.bottom + measurement.lineHeight,
    );
  }

  override draw (): void {
    this.drawTextBackground();
    const style = this.getTextStyleBox();
    const margins = style.getContentMargins();
    const contentWidth = Math.max(0, this.width - margins.left - margins.right);
    const display = this.getVisibleText();
    const shown = display || this.placeholderText;
    const font = this.getTextFont();
    const fontSize = this.getTextFontSize();
    const full = this.measureText(shown, fontSize, font.family, font.weight, font.style);
    const textY = margins.top + Math.max(0, (this.height - margins.top - margins.bottom - full.lineHeight) * 0.5);

    this.updateScrollOffset(contentWidth);
    const textX = this.getAlignedTextX(full.width, contentWidth, margins.left) - this.scrollOffset;

    this.engine.graphics.pushClipRect(margins.left, margins.top, contentWidth, Math.max(0, this.height - margins.top - margins.bottom));
    if (display) {
      const [selectionStart, selectionEnd] = this.getSelectionRange();
      const prefix = this.measurePrefix(selectionStart);
      const selected = this.measurePrefix(selectionEnd) - prefix;

      this.drawSelection(textX + prefix, textY, selected, full.lineHeight);
    }
    this.drawText(textX, textY, shown, fontSize, this.getTextColor(), font.family, font.weight, font.style);
    if (display) {
      this.drawCaret(textX + this.measurePrefix(this.caretColumn), textY, full.lineHeight);
    } else {
      this.drawCaret(textX, textY, full.lineHeight);
    }
    this.engine.graphics.popClipRect();
  }

  protected override getDisplayText (): string {
    return this.getVisibleText();
  }

  protected override getCharacterIndex (position: math.Vector2): number {
    const style = this.getTextStyleBox();
    const margins = style.getContentMargins();
    const contentWidth = Math.max(0, this.width - margins.left - margins.right);
    const fullWidth = this.measurePrefix(this.text.length);
    const origin = this.getAlignedTextX(fullWidth, contentWidth, margins.left) - this.scrollOffset;
    const x = position.x - origin;

    if (x <= 0) {return 0;}
    const boundaries = getCharacterBoundaries(this.text);

    for (let index = 1; index < boundaries.length; index++) {
      const previous = this.measurePrefix(boundaries[index - 1]);
      const next = this.measurePrefix(boundaries[index]);

      if (x < (previous + next) * 0.5) {return boundaries[index - 1];}
    }

    return this.text.length;
  }

  private getVisibleText (): string {
    return this.secret
      ? (this.secretCharacter || '•').repeat(Array.from(this.text).length)
      : this.text;
  }

  private measurePrefix (column: number): number {
    const font = this.getTextFont();
    const prefix = this.text.slice(0, column);
    const visiblePrefix = this.secret
      ? (this.secretCharacter || '•').repeat(Array.from(prefix).length)
      : prefix;

    return this.measureText(
      visiblePrefix, this.getTextFontSize(), font.family, font.weight, font.style,
    ).width;
  }

  private updateScrollOffset (width: number): void {
    if (!this.hasFocus()) {
      this.scrollOffset = 0;

      return;
    }
    const caret = this.measurePrefix(this.caretColumn);

    if (caret - this.scrollOffset > width) {this.scrollOffset = caret - width;}
    if (caret < this.scrollOffset) {this.scrollOffset = caret;}
  }

  private getAlignedTextX (textWidth: number, contentWidth: number, left: number): number {
    if (this.alignment === HorizontalAlignment.Center) {return left + (contentWidth - textWidth) * 0.5;}
    if (this.alignment === HorizontalAlignment.Right) {return left + contentWidth - textWidth;}

    return left;
  }

  override fromData (data: LineEditData): void {
    super.fromData(data);
    if (data.text !== undefined) {this.text = data.text;}
    if (data.placeholderText !== undefined) {this.placeholderText = data.placeholderText;}
    if (data.editable !== undefined) {this.editable = data.editable;}
    if (data.maxLength !== undefined) {this.maxLength = data.maxLength;}
    if (data.secret !== undefined) {this.secret = data.secret;}
    if (data.secretCharacter !== undefined) {this.secretCharacter = data.secretCharacter;}
    if (data.alignment !== undefined) {this.alignment = data.alignment;}
  }
}

function getCharacterBoundaries (value: string): number[] {
  const boundaries = [0];
  let offset = 0;

  for (const character of value) {
    offset += character.length;
    boundaries.push(offset);
  }

  return boundaries;
}
