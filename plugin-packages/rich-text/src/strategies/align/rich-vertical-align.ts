import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichLine, VerticalAlignResult, SizeResult, OverflowResult } from '../rich-text-interfaces';
import type { RichVerticalAlignStrategy } from '../rich-text-interfaces';

/**
 * 富文本垂直对齐策略
 * 直接使用已缩放的行高
 */
export class RichVerticalAlignStrategyImpl implements RichVerticalAlignStrategy {
  getVerticalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: TextLayout,
    style: TextStyle,
    singleLineHeight: number,
  ): VerticalAlignResult {
    // 使用缩放后的行高
    const lineHeights = lines.map(l => l.lineHeight);

    // 使用缩放后的字体大小计算
    const firstLine = lines[0];
    const firstLineMaxFontSize = Math.max(
      ...(firstLine?.richOptions?.map(opt => opt.fontSize) ?? [style.fontSize])
    );
    const fontSizeForOffset = firstLineMaxFontSize * style.fontScale * singleLineHeight;

    const baselineY = layout.getOffsetYRich(style, lineHeights, fontSizeForOffset);

    // 计算行垂直偏移
    const lineYOffsets: number[] = [0];
    let currentOffset = 0;

    for (let i = 1; i < lines.length; i++) {
      currentOffset += lines[i].lineHeight; // 直接使用缩放后值
      lineYOffsets.push(currentOffset);
    }

    return {
      baselineY,
      lineYOffsets,
    };
  }
}
