import type { FontAsset } from '../fontAsset';
import type { ISdfTextParagraphMetrics, ParagraphOptions } from '../paragraphOptions';
import type { BMFontChar } from './bmFont';
import type { SdfGlyph } from './glyph';
import type { SdfTextLine } from './line';

/**
 * 创建自定义布局引擎
 * @param fontAsset - 字体资源
 * @param engineOptions - 布局引擎配置
 * @returns 布局引擎函数
 */
export function createCustomLayoutEngine (
  fontAsset: FontAsset
): (text: string, options: ParagraphOptions) => ISdfTextParagraphMetrics {

  return (text: string, options: ParagraphOptions): ISdfTextParagraphMetrics => {
    const layoutEngine = new LayoutEngine(fontAsset, options);

    return layoutEngine.compute(text);
  };
}

/**
 * 布局引擎类
 */
class LayoutEngine {
  private readonly lineHeight: number;

  constructor (
    private readonly fontAsset: FontAsset,
    private readonly options: ParagraphOptions,
  ) {
    this.lineHeight = fontAsset._font.common.lineHeight * options.lineHeight;
  }

  /**
   * 计算文本布局
   */
  compute (text: string): ISdfTextParagraphMetrics {
    const collapsed = this.collapseWhitespace(text);
    const brokenLines = this.breakLines(collapsed);
    const trimmedLines = brokenLines.map(line => line.trim());

    const lines: SdfTextLine[] = [];

    for (const line of trimmedLines) {
      if (this.options.wordWrap) {
        lines.push(...this.wrapLine(line, lines.length));
      } else {
        lines.push(...this.noWrapLine(line, lines.length));
      }
    }

    const width = Math.max(...lines.map(line => line.width), 0);
    const height = this.lineHeight * lines.length;

    this.applyAlignment(lines, width, height);

    const glyphs = lines.flatMap(line => line.glyphs);

    return {
      paragraph: trimmedLines.join('\n'),
      lines,
      glyphs,
      width,
      height,
    };
  }

  /**
   * 应用对齐方式
   */
  private applyAlignment (lines: SdfTextLine[], width: number, height: number): void {
    const containerHeight = this.options.maxHeight ?? height;
    // 水平对齐使用 maxWidth 作为容器宽度，如果 maxWidth 是 Infinity 则使用文本实际宽度
    const containerWidth = this.options.maxWidth !== Infinity ? this.options.maxWidth : width;

    const verticalOffset = this.calculateVerticalOffset(height, containerHeight);

    for (const line of lines) {
      const horizontalOffset = this.calculateHorizontalOffset(line.width, containerWidth);

      for (const glyph of line.glyphs) {
        glyph.x += horizontalOffset;
        glyph.y += verticalOffset;

        if (this.options.translate) {
          glyph.x += this.options.translate.x * containerWidth;
          glyph.y += this.options.translate.y * containerHeight;
        }
      }
    }
  }

  /**
   * 计算水平偏移量
   * @param lineWidth - 当前行的宽度
   * @param containerWidth - 容器宽度（maxWidth 或文本实际宽度）
   */
  private calculateHorizontalOffset (lineWidth: number, containerWidth: number): number {
    switch (this.options.horizontalAlign) {
      case 'left':
        return 0;
      case 'right':
        return containerWidth - lineWidth;
      case 'center':
      default:
        return (containerWidth - lineWidth) / 2;
    }
  }

  /**
   * 计算垂直偏移量
   */
  private calculateVerticalOffset (textHeight: number, containerHeight: number): number {
    switch (this.options.verticalAlign) {
      case 'top':
        return 0;
      case 'bottom':
        return containerHeight - textHeight;
      case 'middle':
      default:
        return (containerHeight - textHeight) / 2;
    }
  }

  /**
   * 折叠空白字符
   */
  private collapseWhitespace (text: string): string {
    return text
      .replace(/\t/g, ' '.repeat(this.options.tabSize))
      .replace(/ +/g, ' ');
  }

  /**
   * 按换行符分割文本
   */
  private breakLines (text: string): string[] {
    return text.split('\n');
  }

  /**
   * 不换行模式下处理单行文本
   */
  private noWrapLine (text: string, lineOffset: number): SdfTextLine[] {
    const glyphs: SdfGlyph[] = [];
    let currentCursor = 0;
    let currentWidth = 0;
    let lastChar: BMFontChar | undefined;

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const char = this.fontAsset._getChar(charCode);
      const kerning = lastChar ? this.fontAsset._getKerning(lastChar.id, char.id) : 0;

      currentCursor += kerning;

      const x = currentCursor;
      const y = lineOffset * this.lineHeight;

      glyphs.push({
        char,
        line: lineOffset,
        position: i,
        x,
        y,
      });

      const charWidth = char.width;

      currentWidth = Math.max(currentWidth, currentCursor + charWidth);
      currentCursor += char.xadvance + this.options.letterSpacing;
      lastChar = char;
    }

    if (glyphs.length === 0) {
      return [];
    }

    return [{
      text,
      glyphs,
      start: 0,
      end: text.length,
      width: currentWidth,
    }];
  }

  /**
   * 自动换行模式下处理单行文本
   * 与原始 SdfTextParagraph._wrap 方法保持一致的逻辑
   */
  private wrapLine (text: string, lineOffset: number): SdfTextLine[] {
    const lines: SdfTextLine[] = [];

    let currentLine = lineOffset;
    let currentGlyphs: SdfGlyph[] = [];
    let currentCursor = 0;
    let currentWidth = 0;
    let lastChar: BMFontChar | undefined;
    let start = 0;
    let end = start;

    const pushCurrentLine = (): void => {
      lines.push({
        text: text.slice(start, end),
        glyphs: currentGlyphs,
        start,
        end,
        width: currentWidth,
      });
    };

    while (end < text.length) {
      const charCode = text.charCodeAt(end);
      const char = this.fontAsset._getChar(charCode);
      const charWidth = char.width;
      const kerning = lastChar ? this.fontAsset._getKerning(lastChar.id, char.id) : 0;

      currentCursor += kerning;
      const newWidth = currentCursor + charWidth;
      const cursorProgress = char.xadvance + this.options.letterSpacing;
      const nextPosition = currentCursor + cursorProgress;

      const shouldBreak = nextPosition > this.options.maxWidth || newWidth > this.options.maxWidth;

      if (shouldBreak) {
        pushCurrentLine();

        currentLine++;
        lastChar = undefined;
        currentCursor = 0;
        currentWidth = 0;
        start = end;
        end = start + 1;
        currentGlyphs = [];
      }

      const x = currentCursor;
      const y = currentLine * this.lineHeight;

      currentGlyphs.push({
        char,
        line: currentLine,
        position: currentGlyphs.length,
        x,
        y,
      });

      if (!shouldBreak) {
        lastChar = char;
        currentCursor = nextPosition;
        currentWidth = newWidth;
        end++;
      } else {
        currentCursor = cursorProgress;
      }
    }

    if (currentGlyphs.length > 0) {
      pushCurrentLine();
    }

    return lines;
  }
}
