import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { TextStyle, TextLayout } from '@galacean/effects';

/**
 * Visible 溢出策略
 * 允许内容超出画布可见
 */
export class RichVisibleOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle
  ): OverflowResult {
    // 不进行任何缩放或裁剪
    return {
      globalScale: 1,
    };
  }
}
