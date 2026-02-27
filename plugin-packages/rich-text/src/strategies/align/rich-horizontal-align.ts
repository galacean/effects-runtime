import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type {
  RichLine, HorizontalAlignResult, RichHorizontalAlignStrategy,
} from '../rich-text-interfaces';

/**
 * 富文本水平对齐策略
 * 在帧坐标系中计算每行的水平偏移，不依赖溢出模式
 */
export class RichHorizontalAlignStrategyImpl implements RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    frameWidth: number,
    layout: RichTextLayout,
    style: TextStyle,
  ): HorizontalAlignResult {
    // 在帧坐标系 [0, frameWidth] 中计算对齐偏移
    const lineOffsets = lines.map(line =>
      layout.getOffsetXRich(style, frameWidth, line.width)
    );

    return { lineOffsets };
  }
}
