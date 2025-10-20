import type { TextLayout } from '../../text-layout';
import type { TextStyle } from '../../text-style';
import type { WarpStrategy } from './../text-interfaces';

/**
 * WarpDisabledStrategy 禁用自动换行策略
 */
export class WarpDisabledStrategy implements WarpStrategy {
  computeLineBreaks (text: string, availableWidth: number, context: CanvasRenderingContext2D, style: TextStyle, layout: TextLayout, fontScale: number): { lineCount: number, maxLineWidth: number } {
    let lineCount = 1;
    let maxLineWidth = 0;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
      const str = text[i];
      const textMetrics = context.measureText(str).width * fontScale;

      x += layout.letterSpace;

      // 只在换行符处断行，不自动换行
      if (str === '\n') {
        lineCount++;
        maxLineWidth = Math.max(maxLineWidth, x);
        x = 0;
      } else {
        x += textMetrics;
        maxLineWidth = Math.max(maxLineWidth, x);
      }
    }

    return { lineCount, maxLineWidth };
  }
}
