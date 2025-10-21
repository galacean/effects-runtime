import type { TextLayout } from '@galacean/effects';
import { spec } from '@galacean/effects';
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
    let baselineY: number;
    const compY = (sizeResult as any).baselineCompensationY || 0;

    if (layout.overflow === spec.TextOverflow.visible) {
      // 你原来的 frame-based 计算
      const frameH = layout.maxTextHeight;
      const bboxTop = (sizeResult as any).bboxTop ?? 0;
      const bboxHeight = (sizeResult as any).bboxHeight ?? lines.reduce((s, l)=>s + l.lineHeight, 0);

      let baselineYFrame = 0;

      switch (layout.textBaseline) {
        case spec.TextBaseline.top: baselineYFrame = -bboxTop;

          break;
        case spec.TextBaseline.middle: baselineYFrame = (frameH - bboxHeight) / 2 - bboxTop;

          break;
        case spec.TextBaseline.bottom: baselineYFrame = (frameH - bboxHeight) - bboxTop;

          break;
      }
      baselineY = baselineYFrame + compY; // 关键：叠加"向下移动 E"
    } else if (layout.overflow === spec.TextOverflow.clip) {
      // 如果你为 clip 也做了扩张（setCanvasSize 改了），也叠加 compY
      const lineHeights = lines.map(l => l.lineHeight);
      const firstLine = lines[0];
      const firstLineMaxFontSize = Math.max(...(firstLine?.richOptions?.map(opt => opt.fontSize) ?? [style.fontSize]));
      const fontSizeForOffset = firstLineMaxFontSize * style.fontScale * singleLineHeight;

      baselineY = layout.getOffsetYRich(style, lineHeights, fontSizeForOffset) + compY;
    } else {
      // display 保持原有
      const lineHeights = lines.map(l => l.lineHeight);
      const firstLine = lines[0];
      const firstLineMaxFontSize = Math.max(...(firstLine?.richOptions?.map(opt => opt.fontSize) ?? [style.fontSize]));
      const fontSizeForOffset = firstLineMaxFontSize * style.fontScale * singleLineHeight;

      baselineY = layout.getOffsetYRich(style, lineHeights, fontSizeForOffset);
    }

    // 下面行偏移保持不变
    const lineYOffsets: number[] = [0];
    let currentOffset = 0;

    for (let i = 1; i < lines.length; i++) {
      currentOffset += lines[i].lineHeight;
      lineYOffsets.push(currentOffset);
    }

    return { baselineY, lineYOffsets };
  }
}
