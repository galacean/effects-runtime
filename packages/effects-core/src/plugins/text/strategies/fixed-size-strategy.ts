import type { TextLayout } from '../text-layout';
import type { TextStyle } from '../text-style';
import type { SizeStrategy } from './text-strategy-interfaces';

/**
 * Fixed 尺寸策略
 */
export class FixedSizeStrategy implements SizeStrategy {
  calculateSize (text: string, layout: TextLayout, style: TextStyle, context: CanvasRenderingContext2D, lineCount: number):
  { width: number, height: number, transformScaleY: number } {
    const fontScale = style.fontScale;

    // 与原始版本一致：包含 fontOffset 在宽度计算中
    return { width: (layout.width + style.fontOffset) * fontScale, height: layout.height * fontScale, transformScaleY: 1 };
  }
}