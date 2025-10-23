import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine, WrapResult } from '../rich-text-interfaces';
import type { RichWrapStrategy } from '../rich-text-interfaces';

/**
 * 富文本自动换行策略
 * 实现逻辑：基于\n换行及自动换行
 */
export class RichWrapEnabledStrategy implements RichWrapStrategy {
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

    // 切块缓冲变量
    let segStartX: number | null = null;
    let segmentInnerX = 0;
    let chunkChars: RichCharDetail[] = [];
    let chunkOptions: RichTextOptions | null = null; // 跟踪当前切块所属options

    // 结束当前行（含缓冲切块）
    const finishCurrentLine = () => {
      flushChunk();
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
      segStartX = null;
      segmentInnerX = 0;
      chunkChars = [];
      chunkOptions = null;
    };

    // 刷新当前切块
    const flushChunk = () => {
      if (chunkChars.length === 0) {return;}

      if (segStartX === null) {
        segStartX = currentLine.width;
      }

      currentLine.offsetX.push(segStartX);
      currentLine.chars.push(chunkChars);
      if (chunkOptions) {
        currentLine.richOptions.push(chunkOptions);
      }

      // 重置缓冲
      segStartX = null;
      segmentInnerX = 0;
      chunkChars = [];
      chunkOptions = null;
    };

    processedOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      // 设置测量字体（包含fontStyle）
      const fontStyle = options.fontStyle || style.fontStyle || 'normal';

      context.font = `${fontStyle} ${options.fontWeight || style.textWeight} 10px ${options.fontFamily || style.fontFamily}`;

      // 显式换行符优先处理
      if (isNewLine) {
        flushChunk();
        finishCurrentLine();
      }

      // 逐字符处理
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        // 获取基础宽度并计算实际宽度（动态缩放）
        const m = context.measureText(ch);
        const baseW = m.width;
        const charWidth = (baseW <= 0 ? 0 : baseW) * fontSize * scaleFactor * fontScale;

        // 测量 asc/desc 并按目标字号缩放
        const scale = fontSize * fontScale * scaleFactor;
        const asc = m.actualBoundingBoxAscent * scale;
        const desc = m.actualBoundingBoxDescent * scale;

        // 计算预期宽度（包含字符间距）
        const spacing = chunkChars.length > 0 ? letterSpace : 0;
        const willWidth = currentLine.width + spacing + charWidth;

        // 自动换行判断
        if (willWidth > (layout.maxTextWidth || Infinity)) {
          flushChunk();
          finishCurrentLine();
        }

        // 初始化切块起点和所属options
        if (segStartX === null) {
          segStartX = currentLine.width;
          chunkOptions = options; // 绑定当前切块到options
        }

        // 添加字符间距（非首字符）
        if (chunkChars.length > 0) {
          segmentInnerX += letterSpace;
          currentLine.width += letterSpace;
        }

        // 添加字符到切块（x为切块内相对坐标）
        chunkChars.push({
          char: ch,
          x: segmentInnerX, // 切块内相对坐标
          width: charWidth,
        });

        // 累计行级 asc/desc
        currentLine.lineAscent = Math.max(currentLine.lineAscent || 0, asc);
        currentLine.lineDescent = Math.max(currentLine.lineDescent || 0, desc);

        // 更新位置和宽度
        segmentInnerX += charWidth;
        currentLine.width += charWidth;
      }

      // 文本段结束，落盘当前切块
      flushChunk();
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

    const firstVisibleHeight = lines.length > 0 ? (lines[0].lineAscent || 0) + (lines[0].lineDescent || 0) : 0;

    return {
      lines,
      maxLineWidth,
      totalHeight,
      gapPx,
      baselines,
      firstVisibleHeight,
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
      offsetX: [],   // 切块起点（相对行起点）
      width: 0,
      lineHeight: 0,  // 仅用 gapPx 作为行步进
      offsetY: 0,
      chars: [],     // 每个元素为RichCharDetail数组（切块内字符）
      lineAscent: 0,
      lineDescent: 0,
    };
  }
}
