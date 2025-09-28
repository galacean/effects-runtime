import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine } from '../rich-text-interfaces';
import type { RichWrapStrategy, WrapResult } from '../rich-text-interfaces'; // 更新接口名

/**
 * 富文本换行禁用策略
 * 完全基于现有Modern路径的实现逻辑：仅基于\n换行，无自动换行
 */
export class RichWrapDisabledStrategy implements RichWrapStrategy { // 更新类名
  computeLines (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    singleLineHeight: number,
    fontScale: number,
    letterSpace: number,
    scaleFactor: number
  ): WrapResult {
    const lines: RichLine[] = [];
    let currentLine: RichLine = this.createNewLine(
      singleLineHeight, fontScale, layout.lineGap || 0, style.fontSize
    );
    let maxLineWidth = 0;
    let totalHeight = 0;

    const finishCurrentLine = () => {
      totalHeight += currentLine.lineHeight;
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, currentLine.width);
      currentLine = this.createNewLine(
        singleLineHeight, fontScale, (layout.lineGap || 0), style.fontSize
      );
    };

    processedOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      if (isNewLine) {
        // 先结束上一行（保持与 Modern 顺序一致）
        finishCurrentLine();
      }

      // 用当前片段字体（权重/家族）设置测量字体（与 Modern 保持 10px 基准）
      context.font = `${options.fontWeight || style.textWeight} 10px ${options.fontFamily || style.fontFamily}`;

      // 逐段更新本行最大行高（与 Modern 完全一致）
      const textHeight =
        fontSize * singleLineHeight * fontScale + (layout.lineGap || 0) * fontScale;

      if (textHeight > currentLine.lineHeight) {
        currentLine.lineHeight = textHeight;
        currentLine.offsetY = (layout.lineGap || 0) * fontScale / 2;
      }

      // 记录段起始 x
      currentLine.offsetX.push(currentLine.width);

      // 逐字宽度（与 Modern 一致）
      let segmentInnerX = 0;
      const charArr: RichCharDetail[] = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const w = context.measureText(ch).width;
        const charWidth = (w <= 0 ? 0 : w) * fontSize * scaleFactor * fontScale;

        if (i > 0) {
          segmentInnerX += letterSpace; // 先加"前一个字符与当前字符之间"的间距
        }
        charArr.push({ char: ch, x: segmentInnerX, width: charWidth });
        segmentInnerX += charWidth;
      }

      currentLine.chars.push(charArr);
      currentLine.width += segmentInnerX;
      currentLine.richOptions.push(options);
    });

    // 结束最后一行
    finishCurrentLine();

    return { lines, maxLineWidth, totalHeight };
  }

  /**
   * 创建新行（复制现有Modern路径的初始化逻辑）
   */
  private createNewLine (singleLineHeight: number, fontScale: number, lineGap: number, baseFontSize: number): RichLine {
    const gapPx = (lineGap || 0) * fontScale;

    return {
      richOptions: [],
      offsetX: [],
      width: 0,
      lineHeight: baseFontSize * singleLineHeight * fontScale + gapPx, // 初始行高 = 基础字号行高 + gap
      offsetY: gapPx / 2, // 与 Modern 一致
      chars: [],
    };
  }
}
