import type { TextLayout } from '../../text-layout';
import type { TextStyle } from '../../text-style';
import type { WarpStrategy } from './../text-interfaces';

/**
 * WarpEnabledStrategy 启用自动换行策略
 */
export class WarpEnabledStrategy implements WarpStrategy {
  computeLineBreaks (text: string, availableWidth: number, context: CanvasRenderingContext2D, style: TextStyle, layout: TextLayout, fontScale: number): { lineCount: number, maxLineWidth: number } {
    const letterSpace = layout.letterSpace;
    let lineCount = 1;
    let maxLineWidth = 0;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
      const str = text[i];
      const textMetrics = context.measureText(str).width * fontScale;

      // 和浏览器行为保持一致
      x += letterSpace;

      // 在宽度超出时自动换行或在换行符处断行
      if (((x + textMetrics) > availableWidth && i > 0) || str === '\n') {
        lineCount++;
        maxLineWidth = Math.max(maxLineWidth, x);
        x = 0;
      }
      if (str !== '\n') {
        x += textMetrics;
      }
    }
    maxLineWidth = Math.max(maxLineWidth, x);

    return { lineCount, maxLineWidth };
  }
}
