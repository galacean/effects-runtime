import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichLine, HorizontalAlignResult, SizeResult, OverflowResult } from '../rich-text-interfaces';
import type { RichHorizontalAlignStrategy } from '../rich-text-interfaces';

/**
 * 富文本水平对齐策略
 * 直接使用已缩放的行宽计算偏移量
 */
export class RichHorizontalAlignStrategyImpl implements RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: TextLayout,
    style: TextStyle,
  ): HorizontalAlignResult {
    // 直接使用缩放后的行宽
    const lineOffsets = lines.map(line => {
      return layout.getOffsetXRich(style, layout.maxTextWidth, line.width);
    });

    return {
      lineOffsets,
    };
  }

}
