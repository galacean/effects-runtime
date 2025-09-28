import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { TextStyle, TextLayout } from '@galacean/effects';

/**
 * Visible 溢出策略（不缩放、不裁剪的 no-op）
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
      lineScales: new Array(lines.length).fill(1),
      globalScale: 1,
    };
  }
}
