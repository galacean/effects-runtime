import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { TextStyle, TextLayout } from '@galacean/effects';

/**
 * Clip 溢出策略（不缩放、不改几何的 no-op）
 * 超出画布部分自然裁切
 */
export class RichClippedOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle
  ): OverflowResult {
    // 不进行任何缩放，直接返回单位缩放系数
    return {
      lineScales: new Array(lines.length).fill(1),
      globalScale: 1,
    };
  }
}
