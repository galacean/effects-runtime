import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';

/**
 * Clip 溢出策略
 * 超出画布部分自然裁切
 */
export class RichClippedOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: RichTextLayout,
    style: TextStyle
  ): OverflowResult {
    // 不进行任何缩放，直接返回单位缩放系数
    return {
      globalScale: 1,
    };
  }
}
