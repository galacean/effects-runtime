import { spec } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichLine, VerticalAlignResult, SizeResult, OverflowResult } from '../rich-text-interfaces';
import type { RichVerticalAlignStrategy } from '../rich-text-interfaces';

/**
 * 富文本垂直对齐策略
 * 按原版三分支实现：visible/clip/display
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

    switch (layout.overflow) {
      case spec.TextOverflow.visible: {
        // visible：frame-based + baselineCompensationY
        const frameH = layout.maxTextHeight;
        const bboxTop = sizeResult.bboxTop ?? 0;
        const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
        const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

        // 计算 frame 基线
        let baselineYFrame = 0;

        switch (layout.textBaseline) {
          case spec.TextBaseline.top:
            baselineYFrame = -bboxTop;

            break;
          case spec.TextBaseline.middle:
            baselineYFrame = (frameH - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextBaseline.bottom:
            baselineYFrame = (frameH - bboxHeight) - bboxTop;

            break;
        }

        baselineY = baselineYFrame + compY;

        break;
      }
      case spec.TextOverflow.clip: {
        // clip：以第一行最大字号*fontScale*singleLineHeight 作为 fontSize
        const firstLine = lines[0];

        if (firstLine) {
          const firstMax = Math.max(...(firstLine.richOptions.map(o => o.fontSize) || [style.fontSize]));
          const fontSizeForOffset = firstMax * style.fontScale * singleLineHeight;

          baselineY = (layout as any).getOffsetYRich(style, lineHeights, fontSizeForOffset) + compY;
        } else {
          baselineY = (layout as any).getOffsetYRich(style, lineHeights, style.fontSize * style.fontScale) + compY;
        }

        break;
      }
      case spec.TextOverflow.display: {
        // 用缩放后的行数据重建 baselines 和 bbox（使用测得的 asc/desc）
        const frameH = layout.maxTextHeight;

        // 基线序列：第一行基线为0，后续按行高累计
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

        // 计算 display 模式的基线
        let baselineDisplayY = 0;

        switch (layout.textBaseline) {
          case spec.TextBaseline.top:
            baselineDisplayY = -bboxTop;

            break;
          case spec.TextBaseline.middle:
            baselineDisplayY = (frameH - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextBaseline.bottom:
            baselineDisplayY = (frameH - bboxHeight) - bboxTop;

            break;
        }

        // 行偏移：按行高累计
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

    // 计算每行的垂直偏移量
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
