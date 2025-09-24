import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichLine, HorizontalAlignResult, SizeResult, OverflowResult } from '../rich-text-interfaces';
import type { RichHorizontalAlignStrategy } from '../rich-text-interfaces';

/**
 * 富文本水平对齐策略
 * 封装现有TextLayout.getOffsetX逻辑，保持完全一致的行为
 */
export class RichHorizontalAlignStrategyImpl implements RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: TextLayout,
    style: TextStyle,
  ): HorizontalAlignResult {
    const lineOffsets: number[] = [];

    // 完全复制现有Modern路径的水平对齐逻辑
    lines.forEach(line => {
      // 直接使用行宽（溢出策略已处理过缩放）
      const charWidth = line.width;
      const x = layout.getOffsetX(style, charWidth);

      lineOffsets.push(x);
    });

    return {
      lineOffsets,
    };
  }
}
