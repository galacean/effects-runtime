import {
  MouseButton,
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton } from '@galacean/effects';
import type { TextEditData } from '../data';
import { TextInput } from './text-input';

@effectsClass('TextEdit')
export class TextEdit extends TextInput {
  static override readonly themeType: string = 'TextEdit';
  protected readonly multiline = true;
  private scrollLine = 0;

  constructor (engine: Engine, text = '') {
    super(engine);
    this.text = text;
  }

  override getMinimumSize (): math.Vector2 {
    const margins = this.getTextStyleBox().getContentMargins();
    const font = this.getTextFont();
    const line = this.measureText('M', this.getTextFontSize(), font.family, font.weight, font.style);

    return new math.Vector2(margins.left + margins.right + 48, margins.top + margins.bottom + line.lineHeight * 2);
  }

  override getDesiredSize (): math.Vector2 {
    const margins = this.getTextStyleBox().getContentMargins();
    const font = this.getTextFont();
    const fontSize = this.getTextFontSize();
    const lines = (this.text || this.placeholderText).split('\n');
    let width = 0;
    let lineHeight = this.measureText('M', fontSize, font.family, font.weight, font.style).lineHeight;

    for (const line of lines) {
      const measurement = this.measureText(line, fontSize, font.family, font.weight, font.style);

      width = Math.max(width, measurement.width);
      lineHeight = Math.max(lineHeight, measurement.lineHeight);
    }

    return new math.Vector2(
      margins.left + margins.right + width,
      margins.top + margins.bottom + lineHeight * Math.max(2, lines.length),
    );
  }

  override draw (): void {
    this.drawTextBackground();
    const margins = this.getTextStyleBox().getContentMargins();
    const font = this.getTextFont();
    const fontSize = this.getTextFontSize();
    const source = this.text || this.placeholderText;
    const lines = source.split('\n');

    this.scrollLine = Math.max(0, Math.min(lines.length - 1, this.scrollLine));
    const lineHeight = this.measureText('M', fontSize, font.family, font.weight, font.style).lineHeight;
    const [selectionStart, selectionEnd] = this.getSelectionRange();
    let textIndex = lines.slice(0, this.scrollLine).reduce((total, line) => total + line.length + 1, 0);

    this.engine.graphics.pushClipRect(
      margins.left, margins.top,
      Math.max(0, this.width - margins.left - margins.right),
      Math.max(0, this.height - margins.top - margins.bottom),
    );
    for (let lineIndex = this.scrollLine; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const y = margins.top + (lineIndex - this.scrollLine) * lineHeight;

      if (y >= this.height - margins.bottom) {break;}
      if (this.text) {
        const lineStart = textIndex;
        const lineEnd = lineStart + line.length;
        const selectedStart = Math.max(lineStart, selectionStart);
        const selectedEnd = Math.min(lineEnd, selectionEnd);

        if (selectedStart < selectedEnd) {
          const prefix = this.measureLine(line.slice(0, selectedStart - lineStart));
          const selected = this.measureLine(line.slice(selectedStart - lineStart, selectedEnd - lineStart));

          this.drawSelection(margins.left + prefix, y, selected, lineHeight);
        }
      }
      this.drawText(margins.left, y, line, fontSize, this.getTextColor(), font.family, font.weight, font.style);
      if (this.text && this.caretColumn >= textIndex && this.caretColumn <= textIndex + line.length) {
        this.drawCaret(margins.left + this.measureLine(line.slice(0, this.caretColumn - textIndex)), y, lineHeight);
      }
      textIndex += line.length + 1;
    }
    this.engine.graphics.popClipRect();
  }

  override onMouseWheel (event: InputEventMouseButton): void {
    const lines = this.text.split('\n').length;

    if (event.buttonIndex === MouseButton.WheelUp) {
      this.scrollLine = Math.max(0, this.scrollLine - Math.max(1, Math.round(event.factor)));
      event.accept();
    } else if (event.buttonIndex === MouseButton.WheelDown) {
      this.scrollLine = Math.min(Math.max(0, lines - 1), this.scrollLine + Math.max(1, Math.round(event.factor)));
      event.accept();
    }
  }

  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'ArrowUp' || event.keycode === 'ArrowDown') {
      const next = this.getVerticalCaretIndex(event.keycode === 'ArrowUp' ? -1 : 1);

      this.moveCaret(next, event.shiftPressed);
      this.ensureCaretLineVisible();
      event.accept();

      return;
    }
    super.onKeyDown(event);
  }

  protected override getCharacterIndex (position: math.Vector2): number {
    const margins = this.getTextStyleBox().getContentMargins();
    const font = this.getTextFont();
    const lineHeight = this.measureText(
      'M', this.getTextFontSize(), font.family, font.weight, font.style,
    ).lineHeight;
    const lines = this.text.split('\n');
    const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor((position.y - margins.top) / lineHeight) + this.scrollLine));
    const line = lines[lineIndex];
    let index = lines.slice(0, lineIndex).reduce((total, value) => total + value.length + 1, 0);
    const x = position.x - margins.left;

    for (let column = 1; column <= line.length; column++) {
      const previous = this.measureLine(line.slice(0, column - 1));
      const next = this.measureLine(line.slice(0, column));

      if (x < (previous + next) * 0.5) {return index + column - 1;}
    }
    index += line.length;

    return index;
  }

  private measureLine (value: string): number {
    const font = this.getTextFont();

    return this.measureText(value, this.getTextFontSize(), font.family, font.weight, font.style).width;
  }

  private getVerticalCaretIndex (direction: number): number {
    const lines = this.text.split('\n');
    const caret = this.caretColumn;
    let lineStart = 0;
    let lineIndex = 0;

    for (; lineIndex < lines.length - 1; lineIndex++) {
      const lineEnd = lineStart + lines[lineIndex].length;

      if (caret <= lineEnd) {break;}
      lineStart = lineEnd + 1;
    }
    const column = caret - lineStart;
    const targetLine = Math.max(0, Math.min(lines.length - 1, lineIndex + direction));
    let targetStart = 0;

    for (let index = 0; index < targetLine; index++) {targetStart += lines[index].length + 1;}

    return targetStart + Math.min(column, lines[targetLine].length);
  }

  private ensureCaretLineVisible (): void {
    const margins = this.getTextStyleBox().getContentMargins();
    const font = this.getTextFont();
    const lineHeight = this.measureText(
      'M', this.getTextFontSize(), font.family, font.weight, font.style,
    ).lineHeight;
    const visibleLines = Math.max(1, Math.floor((this.height - margins.top - margins.bottom) / lineHeight));
    const caretLine = this.text.slice(0, this.caretColumn).split('\n').length - 1;

    if (caretLine < this.scrollLine) {this.scrollLine = caretLine;} else if (caretLine >= this.scrollLine + visibleLines) {this.scrollLine = caretLine - visibleLines + 1;}
  }

  protected override onTextValueChanged (): void {
    const lineCount = this.text.split('\n').length;
    const caretLine = this.text.slice(0, this.caretColumn).split('\n').length - 1;

    this.scrollLine = Math.max(0, Math.min(lineCount - 1, this.scrollLine));
    if (caretLine < this.scrollLine) {this.scrollLine = caretLine;}
  }

  override fromData (data: TextEditData): void {
    super.fromData(data);
    if (data.text !== undefined) {this.text = data.text;}
    if (data.placeholderText !== undefined) {this.placeholderText = data.placeholderText;}
    if (data.editable !== undefined) {this.editable = data.editable;}
    if (data.maxLength !== undefined) {this.maxLength = data.maxLength;}
  }
}
