import { spec } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type {
  RichLine, VerticalAlignResult, SizeResult, OverflowResult, RichVerticalAlignStrategy,
} from '../rich-text-interfaces';

/**
 * 富文本垂直对齐策略
 * 直接使用已缩放的行高
 */
export class RichVerticalAlignStrategyImpl implements RichVerticalAlignStrategy {
  getVerticalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: RichTextLayout,
    style: TextStyle,
    singleLineHeight: number,
  ): VerticalAlignResult {
    const lineHeights = lines.map(line => line.lineHeight);
    const compY = (sizeResult as any).baselineCompensationY || 0;
    let baselineY = 0;

    if (lines.length === 0) {
      return { baselineY: 0, lineYOffsets: [] };
    }

    switch (layout.overflow) {
      case spec.TextOverflow.visible: {
        // frame-based 计算（使用像素单位）
        const frameHpx = layout.maxTextHeight * style.fontScale;
        const bboxTop = sizeResult.bboxTop ?? 0;
        const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
        const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

        // 计算 frame 基线（使用像素单位）
        let baselineYFrame = 0;

        switch (layout.textVerticalAlign) {
          case spec.TextVerticalAlign.top:
            baselineYFrame = -bboxTop;

            break;
          case spec.TextVerticalAlign.middle:
            baselineYFrame = (frameHpx - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextVerticalAlign.bottom:
            baselineYFrame = (frameHpx - bboxHeight) - bboxTop;

            break;
        }

        baselineY = baselineYFrame + compY; // 关键：叠加"向下移动 E"

        break;
      }
      case spec.TextOverflow.clip: {
        const firstLine = lines[0];

        if (firstLine) {
          const richSizes = firstLine.richOptions.map(o => o.fontSize);
          const firstMax = Math.max(...(richSizes.length ? richSizes : [style.fontSize]));
          const fontSizeForOffset = firstMax * style.fontScale * singleLineHeight;

          baselineY = (layout as any).getOffsetYRich(style, lineHeights, fontSizeForOffset) + compY;
        } else {
          baselineY = (layout as any).getOffsetYRich(style, lineHeights, style.fontSize * style.fontScale) + compY;
        }

        break;
      }
      case spec.TextOverflow.display: {
        // display 垂直对齐改为基于 bbox，而不是 getOffsetYRich
        const frameHpx = layout.maxTextHeight * style.fontScale;

        // 用缩放后的行数据重建 baselines 和 bbox
        const baselines: number[] = [0];

        for (let i = 1; i < lines.length; i++) {
          baselines[i] = baselines[i - 1] + lines[i].lineHeight;
        }

        // 计算 bboxTop / bboxBottom（使用行的测量值 lineAscent/lineDescent）
        let bboxTop = Infinity;
        let bboxBottom = -Infinity;

        for (let i = 0; i < lines.length; i++) {
          const asc = lines[i].lineAscent ?? 0;
          const desc = lines[i].lineDescent ?? 0;

          bboxTop = Math.min(bboxTop, baselines[i] - asc);
          bboxBottom = Math.max(bboxBottom, baselines[i] + desc);
        }

        const bboxHeight = bboxBottom - bboxTop;

        // 计算 display 模式的基线（使用像素单位）
        let baselineDisplayY = 0;

        switch (layout.textVerticalAlign) {
          case spec.TextVerticalAlign.top:
            baselineDisplayY = -bboxTop;

            break;
          case spec.TextVerticalAlign.middle:
            baselineDisplayY = (frameHpx - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextVerticalAlign.bottom:
            baselineDisplayY = (frameHpx - bboxHeight) - bboxTop;

            break;
        }

        // 后续 lineYOffsets 保持按行高累计
        const lineYOffsets: number[] = [];
        let currentY = baselineDisplayY;

        for (let i = 0; i < lines.length; i++) {
          lineYOffsets.push(currentY);
          if (i < lines.length - 1) {
            currentY += lines[i + 1].lineHeight;
          }
        }

        return { baselineY: baselineDisplayY, lineYOffsets };
      }
    }

    // 下面行偏移保持不变
    const lineYOffsets: number[] = [];
    let currentY = baselineY;

    lines.forEach((line, index) => {
      lineYOffsets.push(currentY);
      if (index < lines.length - 1) {
        currentY += lines[index + 1].lineHeight;
      }
    });

    return { baselineY, lineYOffsets };
  }
}
