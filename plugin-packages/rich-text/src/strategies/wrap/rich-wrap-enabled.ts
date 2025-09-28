import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine, WrapResult } from '../rich-text-interfaces';
import type { RichWrapStrategy } from '../rich-text-interfaces';

// 原始测量值缓存（基于10px）
const rawMeasureCache = new Map<string, Map<string, number>>();

// 获取字符基础宽度（基于10px）
function getCharBaseWidth(context: CanvasRenderingContext2D, fontKey: string, ch: string): number {
  if (!rawMeasureCache.has(fontKey)) {
    rawMeasureCache.set(fontKey, new Map());
  }
  const charMap = rawMeasureCache.get(fontKey)!;
  
  if (charMap.has(ch)) {
    return charMap.get(ch)!;
  }
  
  const w = context.measureText(ch).width;
  charMap.set(ch, w);
  return w;
}

/**
 * 富文本自动换行策略
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
    let currentLine: RichLine = this.createNewLine(
      singleLineHeight, fontScale, layout.lineGap || 0, style.fontSize
    );
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
      if (currentLine.chars.length > 0) {
        totalHeight += currentLine.lineHeight;
        lines.push(currentLine);
        maxLineWidth = Math.max(maxLineWidth, currentLine.width);
      }
      currentLine = this.createNewLine(
        singleLineHeight, fontScale, (layout.lineGap || 0), style.fontSize
      );
      segStartX = null;
      segmentInnerX = 0;
      chunkChars = [];
      chunkOptions = null;
    };

    // 刷新当前切块
    const flushChunk = () => {
      if (chunkChars.length === 0) return;
      
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
      const lineGapPx = (layout.lineGap || 0) * fontScale;

      // 设置测量字体（包含fontStyle）
      const fontStyle = options.fontStyle || style.fontStyle || 'normal';
      const fontKey = `${options.fontWeight || style.textWeight}|${fontStyle}|${options.fontFamily || style.fontFamily}`;
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
        const baseW = getCharBaseWidth(context, fontKey, ch);
        const charWidth = (baseW <= 0 ? 0 : baseW) * fontSize * scaleFactor * fontScale;

        // 行高更新（考虑混合字号）
        const textHeight = fontSize * singleLineHeight * fontScale + lineGapPx;
        if (textHeight > currentLine.lineHeight) {
          currentLine.lineHeight = textHeight;
          currentLine.offsetY = lineGapPx / 2;
        }

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

        // 更新位置和宽度
        segmentInnerX += charWidth;
        currentLine.width += charWidth;
      }
      
      // 文本段结束，落盘当前切块
      flushChunk();
    });

    // 结束最后一行
    finishCurrentLine();

    return { lines, maxLineWidth, totalHeight };
  }

  /**
   * 创建新行
   */
  private createNewLine (singleLineHeight: number, fontScale: number, lineGap: number, baseFontSize: number): RichLine {
    const gapPx = lineGap * fontScale;

    return {
      richOptions: [],
      offsetX: [],   // 切块起点（相对行起点）
      width: 0,
      lineHeight: baseFontSize * singleLineHeight * fontScale + gapPx,
      offsetY: gapPx / 2,
      chars: [],     // 每个元素为RichCharDetail数组（切块内字符）
    };
  }
}
