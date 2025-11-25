import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';

/**
 * Visible 溢出策略
 * 允许内容超出画布可见
 */
export class RichVisibleOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: RichTextLayout,
    style: TextStyle
  ): OverflowResult {
    // 不进行任何缩放或裁剪
    return {
      globalScale: 1,
    };
  }
}
