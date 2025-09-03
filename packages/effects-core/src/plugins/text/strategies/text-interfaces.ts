import type { TextLayout } from '../text-layout';
import type { TextStyle } from '../text-style';

// 策略接口定义
export interface SizeStrategy {
  calculateSize(text: string, layout: TextLayout, style: TextStyle, context: CanvasRenderingContext2D, lineCount: number):
  { width: number, height: number, transformScaleY: number },
}

export interface OverflowStrategy {
  apply(ctx: CanvasRenderingContext2D, layout: TextLayout, style: TextStyle, text: string, maxLineWidth: number): void,
}

export interface WarpStrategy {
  computeLineBreaks(
    text: string,
    availableWidth: number,
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    fontScale: number
  ): { lineCount: number, maxLineWidth: number },
}
