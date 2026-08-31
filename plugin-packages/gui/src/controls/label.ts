import {
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, TextMeasurement, spec } from '@galacean/effects';
import { Control } from '../core/control';
import { MouseFilter } from '../core/enums';
import { AutowrapMode, HorizontalAlignment, TextOverflow, VerticalAlignment } from './enums';

type TextLine = {
  text: string,
  measurement: TextMeasurement,
};

type TextLayout = {
  lines: TextLine[],
  lineHeight: number,
  width: number,
  height: number,
};

@effectsClass('Label')
export class Label extends Control {
  static override readonly themeType: string = 'Label';
  private _text = '';
  private _horizontalAlignment = HorizontalAlignment.Left;
  private _verticalAlignment = VerticalAlignment.Top;
  private _autowrapMode = AutowrapMode.Off;
  private _textOverflow = TextOverflow.Visible;
  private layoutDirty = true;
  private layoutWidth = Number.NaN;
  private layout: TextLayout | null = null;

  constructor (engine: Engine, text = '') {
    super(engine);

    this._text = text;
    this.mouseFilter = MouseFilter.Ignore;
  }

  get text (): string {
    return this._text;
  }

  set text (value: string) {
    if (this._text !== value) {
      this._text = value;
      this.invalidateTextLayout();
    }
  }

  get horizontalAlignment (): HorizontalAlignment {
    return this._horizontalAlignment;
  }

  set horizontalAlignment (value: HorizontalAlignment) {
    if (this._horizontalAlignment !== value) {
      this._horizontalAlignment = value;
      this.layoutDirty = true;
    }
  }

  get verticalAlignment (): VerticalAlignment {
    return this._verticalAlignment;
  }

  set verticalAlignment (value: VerticalAlignment) {
    if (this._verticalAlignment !== value) {
      this._verticalAlignment = value;
      this.layoutDirty = true;
    }
  }

  get autowrapMode (): AutowrapMode {
    return this._autowrapMode;
  }

  set autowrapMode (value: AutowrapMode) {
    if (this._autowrapMode !== value) {
      this._autowrapMode = value;
      this.invalidateTextLayout();
    }
  }

  get textOverflow (): TextOverflow {
    return this._textOverflow;
  }

  set textOverflow (value: TextOverflow) {
    if (this._textOverflow !== value) {
      this._textOverflow = value;
      this.layoutDirty = true;
      this.updateMinimumSize();
    }
  }

  override getMinimumSize (): math.Vector2 {
    const natural = this.createNaturalLayout();

    if (this.autowrapMode === AutowrapMode.Off) {
      return new math.Vector2(
        this.textOverflow === TextOverflow.Visible ? natural.width : 0,
        natural.height,
      );
    }

    const width = this.getMinimumLineWidth();
    const paragraphCount = Math.max(1, this._text.split('\n').length);

    return new math.Vector2(
      width,
      natural.lineHeight * paragraphCount + this.getThemeConstant('lineSpacing') * Math.max(0, paragraphCount - 1),
    );
  }

  override getDesiredSize (): math.Vector2 {
    const layout = this.createNaturalLayout();

    return new math.Vector2(layout.width, layout.height);
  }

  override draw (): void {
    const layout = this.getTextLayout(this.width);
    const clipped = this.textOverflow !== TextOverflow.Visible;
    const gap = this.getVerticalGap(layout);
    let y = this.getTextStartY(layout, gap);

    if (clipped) {
      this.engine.graphics.pushClipRect(0, 0, this.width, this.height);
    }
    try {
      for (let i = 0; i < layout.lines.length; i++) {
        const source = layout.lines[i];
        const line = this.textOverflow === TextOverflow.Ellipsis
          ? this.ellipsize(source, this.width)
          : source;
        const fill = this.horizontalAlignment === HorizontalAlignment.Fill && i < layout.lines.length - 1;

        if (fill && countFillSpaces(line.text) > 0 && line.measurement.width < this.width) {
          this.drawFilledLine(line, y);
        } else {
          this.drawThemedText(this.getTextStartX(line.measurement.width), y, line.text);
        }
        y += layout.lineHeight + this.getThemeConstant('lineSpacing') + gap;
      }
    } finally {
      if (clipped) {
        this.engine.graphics.popClipRect();
      }
    }
  }

  private invalidateTextLayout (): void {
    this.layoutDirty = true;
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  protected override onThemeChanged (affectsLayout: boolean): void {
    if (affectsLayout) {this.layoutDirty = true;}
    super.onThemeChanged(affectsLayout);
  }

  private measure (text: string): TextMeasurement {
    const font = this.getThemeFont('font');

    return this.measureText(text, this.getThemeFontSize('fontSize'), font.family, font.weight, font.style);
  }

  private getTextLayout (width: number): TextLayout {
    const constrainedWidth = this.autowrapMode === AutowrapMode.Off ? Number.POSITIVE_INFINITY : Math.max(0, width);

    if (this.layoutDirty || this.layoutWidth !== constrainedWidth || !this.layout) {
      this.layout = this.createLayout(constrainedWidth);
      this.layoutWidth = constrainedWidth;
      this.layoutDirty = false;
    }

    return this.layout;
  }

  private createNaturalLayout (): TextLayout {
    return this.createLayout(Number.POSITIVE_INFINITY);
  }

  private createLayout (width: number): TextLayout {
    const lines: TextLine[] = [];
    const paragraphs = this.text.split('\n');
    const emptyMeasurement = this.measure('');

    for (const paragraph of paragraphs) {
      if (this.autowrapMode === AutowrapMode.Off || !Number.isFinite(width)) {
        lines.push({ text: paragraph, measurement: this.measure(paragraph) });
      } else {
        lines.push(...this.wrapParagraph(paragraph, width));
      }
    }
    if (lines.length === 0) {
      lines.push({ text: '', measurement: emptyMeasurement });
    }

    const lineHeight = lines[0]?.measurement.lineHeight ?? emptyMeasurement.lineHeight;
    const maximumWidth = lines.reduce((value, line) => Math.max(value, line.measurement.width), 0);
    const height = lineHeight * lines.length + this.getThemeConstant('lineSpacing') * Math.max(0, lines.length - 1);

    return { lines, lineHeight, width: maximumWidth, height };
  }

  private wrapParagraph (paragraph: string, width: number): TextLine[] {
    const characters = Array.from(paragraph);

    if (characters.length === 0) {
      return [{ text: '', measurement: this.measure('') }];
    }
    if (width <= 0) {
      return characters.map(text => ({ text, measurement: this.measure(text) }));
    }

    const measurement = this.measure(paragraph);
    const lines: TextLine[] = [];
    let start = 0;

    while (start < characters.length) {
      let cursorWidth = 0;
      let breakEnd = -1;
      let breakNext = -1;
      let index = start;

      for (; index < characters.length; index++) {
        const character = characters[index];
        const advance = measurement.advances[index] ?? 0;

        if (cursorWidth + advance > width && index > start) {
          break;
        }
        cursorWidth += advance;
        if (isBreakSpace(character)) {
          breakEnd = index;
          breakNext = index + 1;
        } else if (isCJKLike(character)) {
          breakEnd = index + 1;
          breakNext = index + 1;
        }
        if (cursorWidth > width) {
          index++;

          break;
        }
      }

      if (index >= characters.length) {
        const text = characters.slice(start).join('');

        lines.push({ text, measurement: this.measure(text) });

        break;
      }

      let end: number;
      let next: number;

      if (this.autowrapMode !== AutowrapMode.Arbitrary && breakEnd > start) {
        end = breakEnd;
        next = breakNext;
      } else if (this.autowrapMode === AutowrapMode.Word) {
        end = this.findWordEnd(characters, index);
        next = end;
      } else {
        end = Math.max(start + 1, index);
        next = end;
      }

      const text = characters.slice(start, end).join('').replace(/[\t \u00a0]+$/, '');

      lines.push({ text, measurement: this.measure(text) });
      start = skipBreakSpaces(characters, Math.max(next, start + 1));
    }

    return lines;
  }

  private findWordEnd (characters: string[], start: number): number {
    for (let i = Math.max(1, start); i < characters.length; i++) {
      if (isBreakSpace(characters[i]) || isCJKLike(characters[i])) {
        return isBreakSpace(characters[i]) ? i : i + 1;
      }
    }

    return characters.length;
  }

  private getMinimumLineWidth (): number {
    const paragraphs = this.text.split('\n');
    let width = 0;

    if (this.autowrapMode === AutowrapMode.Arbitrary || this.autowrapMode === AutowrapMode.WordSmart) {
      for (const paragraph of paragraphs) {
        for (const character of Array.from(paragraph)) {
          width = Math.max(width, this.measure(character).width);
        }
      }

      return width;
    }

    for (const paragraph of paragraphs) {
      let segment = '';

      for (const character of Array.from(paragraph)) {
        if (isBreakSpace(character) || isCJKLike(character)) {
          width = Math.max(width, this.measure(segment).width, this.measure(character).width);
          segment = '';
        } else {
          segment += character;
        }
      }
      width = Math.max(width, this.measure(segment).width);
    }

    return width;
  }

  private getTextStartX (lineWidth: number): number {
    if (this.horizontalAlignment === HorizontalAlignment.Center) {
      return (this.width - lineWidth) * 0.5;
    }
    if (this.horizontalAlignment === HorizontalAlignment.Right) {
      return this.width - lineWidth;
    }

    return 0;
  }

  private getTextStartY (layout: TextLayout, gap: number): number {
    const height = layout.height + gap * Math.max(0, layout.lines.length - 1);

    if (this.verticalAlignment === VerticalAlignment.Center) {
      return (this.height - height) * 0.5;
    }
    if (this.verticalAlignment === VerticalAlignment.Bottom) {
      return this.height - height;
    }

    return 0;
  }

  private getVerticalGap (layout: TextLayout): number {
    if (this.verticalAlignment !== VerticalAlignment.Fill || layout.lines.length < 2) {
      return 0;
    }

    return Math.max(0, (this.height - layout.height) / (layout.lines.length - 1));
  }

  private ellipsize (line: TextLine, width: number): TextLine {
    if (line.measurement.width <= width) {
      return line;
    }

    const ellipsis = '…';
    const ellipsisMeasurement = this.measure(ellipsis);

    if (ellipsisMeasurement.width > width) {
      return { text: '', measurement: this.measure('') };
    }

    const characters = Array.from(line.text);
    let used = ellipsisMeasurement.width;
    let count = 0;

    for (; count < characters.length; count++) {
      const advance = line.measurement.advances[count] ?? 0;

      if (used + advance > width) {
        break;
      }
      used += advance;
    }

    const text = characters.slice(0, count).join('') + ellipsis;

    return { text, measurement: this.measure(text) };
  }

  private drawFilledLine (line: TextLine, y: number): void {
    const characters = Array.from(line.text);
    const spaces = countFillSpaces(line.text);
    const extra = spaces > 0 ? (this.width - line.measurement.width) / spaces : 0;
    let x = 0;

    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];

      this.drawThemedText(x, y, character);
      x += line.measurement.advances[i] ?? 0;
      if (isBreakSpace(character)) {
        x += extra;
      }
    }
  }

  private drawThemedText (x: number, y: number, text: string): void {
    const font = this.getThemeFont('font');

    this.drawText(
      x,
      y,
      text,
      this.getThemeFontSize('fontSize'),
      this.getThemeColor('fontColor'),
      font.family,
      font.weight,
      font.style,
    );
  }

  override fromData (data: spec.LabelData): void {
    super.fromData(data);
    if (data.text !== undefined) {
      this.text = data.text;
    }
    if (data.horizontalAlignment !== undefined) {
      this.horizontalAlignment = data.horizontalAlignment;
    }
    if (data.verticalAlignment !== undefined) {
      this.verticalAlignment = data.verticalAlignment;
    }
    if (data.autowrapMode !== undefined) {
      this.autowrapMode = data.autowrapMode;
    }
    if (data.textOverflow !== undefined) {
      this.textOverflow = data.textOverflow;
    }
  }
}

function isBreakSpace (character: string): boolean {
  return character === ' ' || character === '\t' || character === '\u00a0';
}

function isCJKLike (character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;

  return (codePoint >= 0x3400 && codePoint <= 0x4dbf)
    || (codePoint >= 0x4e00 && codePoint <= 0x9fff)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0x20000 && codePoint <= 0x2fa1f)
    || (codePoint >= 0x3040 && codePoint <= 0x30ff)
    || (codePoint >= 0xac00 && codePoint <= 0xd7af);
}

function skipBreakSpaces (characters: string[], start: number): number {
  let index = start;

  while (index < characters.length && isBreakSpace(characters[index])) {
    index++;
  }

  return index;
}

function countFillSpaces (text: string): number {
  return Array.from(text).reduce((count, character) => count + (isBreakSpace(character) ? 1 : 0), 0);
}
