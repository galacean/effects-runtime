import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine, RichWrapStrategy, WrapResult } from '../rich-text-interfaces';

/**
 * 富文本换行禁用策略
 * 实现逻辑：仅基于\n换行，无自动换行
 */
export class RichWrapDisabledStrategy implements RichWrapStrategy {
  computeLines (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: RichTextLayout,
    letterSpace: number,
  ): WrapResult {
    const lines: RichLine[] = [];
    const baselines: number[] = [];
    const gapPx = layout.lineHeight || 0;
    const scaleFactor = 1 / 10; // 1/10px, 后面 context.font 设置的字号为10px
    let currentLine: RichLine = this.createNewLine();
    let maxLineWidth = 0;
    let totalHeight = 0;

    const finishCurrentLine = () => {
      if (currentLine.chars.length === 0) { return; }

      // 所有行都使用配置的行高（gapPx）
      currentLine.lineHeight = gapPx;

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

      // 预计算缩放因子：measureText 基于 10px，乘 fontSize/10 得到逻辑像素
      const glyphScale = fontSize * scaleFactor;

      // 使用字体级别度量（不随具体字符变化），保证基线位置稳定
      const refMetrics = context.measureText('x');
      const fontAsc = refMetrics.fontBoundingBoxAscent * glyphScale;
      const fontDesc = refMetrics.fontBoundingBoxDescent * glyphScale;

      // 逐字宽度测量
      let segmentInnerX = 0;
      const charArr: RichCharDetail[] = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const m = context.measureText(ch);
        const w = m.width;
        const charWidth = (w <= 0 ? 0 : w) * glyphScale;

        if (i > 0) {
          segmentInnerX += letterSpace; // 先加"前一个字符与当前字符之间"的间距
        }
        charArr.push({ char: ch, x: segmentInnerX });
        segmentInnerX += charWidth;
      }

      currentLine.chars.push(charArr);
      currentLine.width += segmentInnerX;
      currentLine.richOptions.push(options);

      // 累计行级 asc/desc（字体级别，不因字符形状改变）
      currentLine.lineAscent = Math.max(currentLine.lineAscent || 0, fontAsc);
      currentLine.lineDescent = Math.max(currentLine.lineDescent || 0, fontDesc);
    });

    // 结束最后一行
    finishCurrentLine();

    // 计算 bbox（包含行高带来的上下边距）
    let bboxTop = Infinity;
    let bboxBottom = -Infinity;

    if (lines.length === 0) {
      return {
        lines,
        maxLineWidth,
        totalHeight,
        bboxTop: 0,
        bboxBottom: 0,
        bboxHeight: 0,
      };
    }

    for (let i = 0; i < lines.length; i++) {
      const asc = lines[i].lineAscent || 0;
      const desc = lines[i].lineDescent || 0;
      const textHeight = asc + desc;
      const margin = (gapPx - textHeight) / 2;

      bboxTop = Math.min(bboxTop, baselines[i] - asc - margin);
      bboxBottom = Math.max(bboxBottom, baselines[i] + desc + margin);
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
