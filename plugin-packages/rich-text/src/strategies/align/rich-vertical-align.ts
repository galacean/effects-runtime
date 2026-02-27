import { spec } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type {
  RichLine, VerticalAlignResult, RichVerticalAlignStrategy,
} from '../rich-text-interfaces';

/**
 * 富文本垂直对齐策略
 * 在帧坐标系中计算基线位置，不依赖溢出模式
 *
 * 算法：
 * 1. 从行数据重建各行基线（baseline[0]=0, baseline[i]=baseline[i-1]+lineHeight[i]）
 * 2. 计算 bbox（包含行高边距）
 * 3. 根据 textVerticalAlign 将内容定位到帧中
 */
export class RichVerticalAlignStrategyImpl implements RichVerticalAlignStrategy {
  getVerticalOffsets (
    lines: RichLine[],
    frameHeight: number,
    layout: RichTextLayout,
  ): VerticalAlignResult {
    if (lines.length === 0) {
      return { baselineY: 0, lineYOffsets: [] };
    }

    // 1. 重建各行基线（相对于第一行基线=0）
    const baselines: number[] = [0];

    for (let i = 1; i < lines.length; i++) {
      baselines[i] = baselines[i - 1] + lines[i].lineHeight;
    }

    // 2. 计算内容 bbox（含行高边距）
    let bboxTop = Infinity;
    let bboxBottom = -Infinity;

    for (let i = 0; i < lines.length; i++) {
      const asc = lines[i].lineAscent ?? 0;
      const desc = lines[i].lineDescent ?? 0;
      const textHeight = asc + desc;
      const margin = (lines[i].lineHeight - textHeight) / 2;

      bboxTop = Math.min(bboxTop, baselines[i] - asc - margin);
      bboxBottom = Math.max(bboxBottom, baselines[i] + desc + margin);
    }

    const bboxHeight = bboxBottom - bboxTop;

    // 3. 在帧坐标系 [0, frameHeight] 中定位第一行基线
    let baselineY = 0;

    switch (layout.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
        baselineY = -bboxTop;

        break;
      case spec.TextVerticalAlign.middle:
        baselineY = (frameHeight - bboxHeight) / 2 - bboxTop;

        break;
      case spec.TextVerticalAlign.bottom:
        baselineY = (frameHeight - bboxHeight) - bboxTop;

        break;
    }

    // 4. 各行 Y 坐标
    const lineYOffsets = baselines.map(b => baselineY + b);

    return { baselineY, lineYOffsets };
  }
}
