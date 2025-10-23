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
    const frameW = layout.maxTextWidth;
    const compX = (sizeResult as any).baselineCompensationX || 0;

    // 统一用 frame 宽做容器
    const baseOffsets = lines.map(line =>
      layout.getOffsetXRich(style, frameW, line.width)
    );

    // 仅 visible 叠加水平补偿，clip/display 不加
    const lineOffsets =
      layout.overflow === spec.TextOverflow.visible
        ? baseOffsets.map(x => x + compX)
        : baseOffsets;

    return { lineOffsets };
  }
}

