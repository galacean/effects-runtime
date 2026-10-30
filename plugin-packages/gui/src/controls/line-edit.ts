import { effectsClass, math, TextCache } from '@galacean/effects';
import type { Engine, TextLineLayout, spec } from '@galacean/effects';
import { getTextBoundaries, getTextIndexAtPosition, getTextPosition } from '../core/text-layout';
import { HorizontalAlignment } from './enums';
import { TextInput } from './text-input';

@effectsClass('LineEdit')
export class LineEdit extends TextInput {
  static override readonly themeType: string = 'LineEdit';
  protected readonly multiline = false;
  alignment = HorizontalAlignment.Left;
  private scrollOffset = 0;
  private _secret = false;
  private _secretCharacter = '•';

  constructor (engine: Engine, text = '') {
    super(engine);
    this.text = text;
  }

  get secret (): boolean { return this._secret; }
  set secret (value: boolean) {
    if (this._secret !== value) {
      this._secret = value;
      this.updateDesiredSize();
    }
  }

  get secretCharacter (): string { return this._secretCharacter; }
  set secretCharacter (value: string) {
    const character = TextCache.graphemeSegmenter(value)[0] ?? '';

    if (this._secretCharacter !== character) {
      this._secretCharacter = character;
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
    const measurement = this.measureText(display, this.getTextFontSize(), font.family, font.weight, font.style, false);

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
    const full = display ? this.getVisibleLayout() : this.measureText(shown, fontSize, font.family, font.weight, font.style, false).lines[0];
    const textY = margins.top + Math.max(0, (this.height - margins.top - margins.bottom - full.lineHeight) * 0.5);
    const caretX = display ? this.measurePrefix(this.caretColumn, full) : 0;
    const alignedX = this.getAlignedTextX(full.width, contentWidth, 0);

    this.updateScrollOffset(contentWidth, alignedX + caretX, alignedX, full.width);
    const textX = margins.left + alignedX - this.scrollOffset;

    this.engine.renderingServer.graphics.pushClipRect(margins.left, margins.top, contentWidth, Math.max(0, this.height - margins.top - margins.bottom));
    if (display) {
      const [selectionStart, selectionEnd] = this.getSelectionRange();
      const prefix = this.measurePrefix(selectionStart, full);
      const selected = this.measurePrefix(selectionEnd, full) - prefix;

      this.drawSelection(textX + prefix, textY, selected, full.lineHeight);
    }
    this.drawText(textX, textY, shown, fontSize, this.getTextColor(), font.family, font.weight, font.style);
    if (display) {
      this.drawCaret(textX + caretX, textY, full.lineHeight);
    } else {
      this.drawCaret(textX, textY, full.lineHeight);
    }
    this.engine.renderingServer.graphics.popClipRect();
  }

  protected override getDisplayText (): string {
    return this.getVisibleText();
  }

  protected override getCharacterIndex (position: math.Vector2): number {
    const style = this.getTextStyleBox();
    const margins = style.getContentMargins();
    const contentWidth = Math.max(0, this.width - margins.left - margins.right);
    const layout = this.getVisibleLayout();
    const origin = this.getAlignedTextX(layout.width, contentWidth, margins.left) - this.scrollOffset;
    const x = position.x - origin;

    return getTextIndexAtPosition(layout, x);
  }

  private getVisibleText (): string {
    return this.secret
      ? (this.secretCharacter || '•').repeat(TextCache.graphemeSegmenter(this.text).length)
      : this.text;
  }

  private measurePrefix (column: number, layout = this.getVisibleLayout()): number {
    return getTextPosition(layout, column);
  }

  private getVisibleLayout (): TextLineLayout {
    const font = this.getTextFont();
    const layout = this.measureText(this.getVisibleText(), this.getTextFontSize(), font.family, font.weight, font.style, false).lines[0];

    layout.boundaries = getTextBoundaries(this.text);

    return layout;
  }

  private updateScrollOffset (width: number, caret: number, textOrigin: number, textWidth: number): void {
    if (!this.hasFocus()) {
      this.scrollOffset = 0;

      return;
    }
    const minimum = Math.min(0, textOrigin);
    const maximum = Math.max(0, textOrigin + textWidth - width);

    this.scrollOffset = Math.max(minimum, Math.min(maximum, this.scrollOffset));
    if (caret - this.scrollOffset > width) {this.scrollOffset = caret - width;}
    if (caret < this.scrollOffset) {this.scrollOffset = caret;}
  }

  private getAlignedTextX (textWidth: number, contentWidth: number, left: number): number {
    if (this.alignment === HorizontalAlignment.Center) {return left + (contentWidth - textWidth) * 0.5;}
    if (this.alignment === HorizontalAlignment.Right) {return left + contentWidth - textWidth;}

    return left;
  }

  override fromData (data: spec.LineEditData): void {
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
