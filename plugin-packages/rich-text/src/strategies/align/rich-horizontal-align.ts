import { spec } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type {
  RichLine, HorizontalAlignResult, SizeResult, OverflowResult, RichHorizontalAlignStrategy,
} from '../rich-text-interfaces';

/**
 * 富文本水平对齐策略
 * 直接使用已缩放的行宽计算偏移量
 */
export class RichHorizontalAlignStrategyImpl implements RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: RichTextLayout,
    style: TextStyle,
  ): HorizontalAlignResult {
    const containerWidthPx =
      (sizeResult as any).containerWidth ?? (layout.maxTextWidth * style.fontScale);
    const compX = (sizeResult as any).baselineCompensationX || 0;

    // 使用像素单位的容器宽度
    const baseOffsets = lines.map(line =>
      (layout as any).getOffsetXRich(style, containerWidthPx, line.width)
    );

    // visible 模式下使用 baseOffset + baselineCompensationX
    const lineOffsets =
      layout.overflow === spec.TextOverflow.visible
        ? baseOffsets.map(x => x + compX)
        : baseOffsets;

    return { lineOffsets };
  }
}
