import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichLine, VerticalAlignResult, SizeResult, OverflowResult } from '../rich-text-interfaces';
import type { RichVerticalAlignStrategy } from '../rich-text-interfaces';

/**
 * 富文本垂直对齐策略
 * 封装现有TextLayout.getOffsetYRich逻辑，保持完全一致的行为
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
    // 完全复制现有Modern路径的垂直对齐逻辑
    const lineHeights = lines.map(l => l.lineHeight);

    // 计算第一行基线Y坐标（复制现有逻辑）
    const firstLine = lines[0];
    const firstLineMaxFontSize = Math.max(...(firstLine?.richOptions?.map(opt => opt.fontSize) ?? [style.fontSize]));
    const fontSizeForOffset = firstLineMaxFontSize * style.fontScale * singleLineHeight;

    // 使用TextLayout.getOffsetYRich计算基线位置（复制现有逻辑）
    const baselineY = layout.getOffsetYRich(style, lineHeights, fontSizeForOffset);

    // 计算每行的垂直偏移（复制现有逻辑）
    const lineYOffsets: number[] = [0]; // 第一行偏移为0
    let currentOffset = 0;

    for (let i = 1; i < lines.length; i++) {
      currentOffset += lines[i].lineHeight;
      lineYOffsets.push(currentOffset);
    }

    return {
      baselineY,
      lineYOffsets,
    };
  }
}
