import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine } from '../rich-text-interfaces';
import type { RichWrapStrategy, WrapResult } from '../rich-text-interfaces'; // 更新接口名

/**
 * 富文本换行禁用策略
 * 实现逻辑：仅基于\n换行，无自动换行
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
    const baselines: number[] = [];
    const gapPx = (layout.lineGap || 0) * fontScale;
    let currentLine: RichLine = this.createNewLine();
    let maxLineWidth = 0;
    let totalHeight = 0;

    const finishCurrentLine = () => {
      if (currentLine.chars.length === 0) {return;}

      // 第1行用真实首行高度，其余行用 gapPx
      currentLine.lineHeight = lines.length === 0
        ? (currentLine.lineAscent || 0) + (currentLine.lineDescent || 0)
        : gapPx;

      // 记录本行基线
      const baseline = lines.length === 0 ? 0 : (baselines[baselines.length - 1] + gapPx);

      baselines.push(baseline);

      totalHeight += currentLine.lineHeight;
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, currentLine.width);
      currentLine = this.createNewLine();
    };

    processedOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      if (isNewLine) {
        // 先结束上一行
        finishCurrentLine();
      }

      // 用当前片段字体（权重/家族）设置测量字体
      const fontStyle = options.fontStyle || style.fontStyle || 'normal';

      context.font = `${fontStyle} ${options.fontWeight || style.textWeight} 10px ${options.fontFamily || style.fontFamily}`;

      // 记录段起始 x
      currentLine.offsetX.push(currentLine.width);

      // 逐字宽度和高度测量（新增 asc/desc 测量）
      let segmentInnerX = 0;
      const charArr: RichCharDetail[] = [];
      let lineAscent = 0;
      let lineDescent = 0;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const m = context.measureText(ch);
        const w = m.width;
        const charWidth = (w <= 0 ? 0 : w) * fontSize * scaleFactor * fontScale;

        // 测量 asc/desc 并按目标字号缩放
        const scale = fontSize * fontScale * scaleFactor;
        const asc = m.actualBoundingBoxAscent * scale;
        const desc = m.actualBoundingBoxDescent * scale;

        lineAscent = Math.max(lineAscent, asc);
        lineDescent = Math.max(lineDescent, desc);

        if (i > 0) {
          segmentInnerX += letterSpace; // 先加"前一个字符与当前字符之间"的间距
        }
        charArr.push({ char: ch, x: segmentInnerX });
        segmentInnerX += charWidth;
      }

      currentLine.chars.push(charArr);
      currentLine.width += segmentInnerX;
      currentLine.richOptions.push(options);

      // 累计行级 asc/desc
      currentLine.lineAscent = Math.max(currentLine.lineAscent || 0, lineAscent);
      currentLine.lineDescent = Math.max(currentLine.lineDescent || 0, lineDescent);
    });

    // 结束最后一行
    finishCurrentLine();

    // 计算 bbox
    let bboxTop = Infinity;
    let bboxBottom = -Infinity;

    for (let i = 0; i < lines.length; i++) {
      bboxTop = Math.min(bboxTop, baselines[i] - (lines[i].lineAscent || 0));
      bboxBottom = Math.max(bboxBottom, baselines[i] + (lines[i].lineDescent || 0));
    }
    const bboxHeight = bboxBottom - bboxTop;

    return {
      lines,
      maxLineWidth,
      totalHeight,
      bboxTop,
      bboxBottom,
      bboxHeight,
    };
  }

  /**
   * 创建新行
   */
  private createNewLine (): RichLine {
    return {
      richOptions: [],
      offsetX: [],
      width: 0,
      lineHeight: 0,
      offsetY: 0,
      chars: [],
      lineAscent: 0,
      lineDescent: 0,
    };
  }
}
