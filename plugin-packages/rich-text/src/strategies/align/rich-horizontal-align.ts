import type { TextLayout } from '@galacean/effects';
import { spec } from '@galacean/effects';
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
    // 对齐容器宽：display 用 frameW，其它用最终画布宽
    const containerWidth =
      layout.overflow === spec.TextOverflow.display
        ? layout.maxTextWidth
        : (sizeResult.canvasWidth || layout.maxTextWidth);

    const lineOffsets = lines.map(line =>
      layout.getOffsetXRich(style, containerWidth, line.width)
    );

    // 不再叠加 baselineCompensationX
    return { lineOffsets };
  }

}
