import type { TextLayout } from '../text-layout';
import type { TextStyle } from '../text-style';
import type { SizeStrategy } from './text-strategy-interfaces';

/**
 * AutoWidth 尺寸策略
 */
export class AutoWidthStrategy implements SizeStrategy {
  calculateSize (text: string, layout: TextLayout, style: TextStyle, context: CanvasRenderingContext2D, lineCount: number):
  { width: number, height: number, transformScaleY: number } {
    const fontScale = style.fontScale;
    // 与原始版本一致：使用固定宽度计算，包含 fontOffset
    const width = (layout.width + style.fontOffset) * fontScale;
    const finalHeight = layout.lineHeight * lineCount;
    const height = finalHeight * fontScale;
    const transformScaleY = finalHeight / layout.height;

    return { width, height, transformScaleY };
  }
}