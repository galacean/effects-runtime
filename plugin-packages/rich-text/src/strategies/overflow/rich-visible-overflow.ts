import { spec, type TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';

/**
 * Visible 溢出策略
 * 允许内容超出画布可见
 */
export class RichVisibleOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: RichTextLayout,
    style: TextStyle
  ): OverflowResult {
    const textStyle = style;
    const fontScale = textStyle.fontScale || 1;

    // 防止 frameW / frameH 为 0
    const frameW = layout.maxTextWidth;
    const frameH = layout.maxTextHeight;

    const frameWpx = frameW * fontScale;
    const frameHpx = frameH * fontScale;

    const bboxTop = sizeResult.bboxTop ?? 0;
    const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
    const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

    // 计算 frame 基线
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

    // 水平扩张也要用到 lines，提前获取
    const sizeResultLines = sizeResult.lines || [];

    // 用行数据重建各行基线
    const baselines: number[] = [];

    for (let i = 0; i < sizeResultLines.length; i++) {
      baselines[i] = i === 0 ? 0 : baselines[i - 1] + (sizeResultLines[i].lineHeight || 0);
    }

    // 计算实际字形渲染范围（baseline ± ascent/descent）
    // 当 lineHeight < 文字高度时，字形会超出 bbox 边界
    let glyphTopInFrame = baselineYFrame;
    let glyphBottomInFrame = baselineYFrame;

    for (let i = 0; i < sizeResultLines.length; i++) {
      const asc = sizeResultLines[i].lineAscent ?? 0;
      const desc = sizeResultLines[i].lineDescent ?? 0;

      glyphTopInFrame = Math.min(glyphTopInFrame, baselineYFrame + baselines[i] - asc);
      glyphBottomInFrame = Math.max(glyphBottomInFrame, baselineYFrame + baselines[i] + desc);
    }

    // 上下溢出检测：取 bbox 和字形范围的最大包围
    const contentTopInFrame = Math.min(baselineYFrame + bboxTop, glyphTopInFrame);
    const contentBottomInFrame = Math.max(baselineYFrame + bboxBottom, glyphBottomInFrame);

    const overflowTop = Math.max(0, -contentTopInFrame);
    const overflowBottom = Math.max(0, contentBottomInFrame - frameHpx);

    // 垂直扩张
    let expandTop = overflowTop;
    let expandBottom = overflowBottom;

    switch (layout.textVerticalAlign) {
      case spec.TextVerticalAlign.top: {
        const E = Math.max(overflowTop, overflowBottom);

        expandTop = E;
        expandBottom = E;

        break;
      }
      case spec.TextVerticalAlign.bottom: {
        const E = Math.max(overflowTop, overflowBottom);

        expandTop = E;
        expandBottom = E;

        break;
      }
      case spec.TextVerticalAlign.middle: {
        // 保持非对称：上扩 overflowTop，下扩 overflowBottom
        expandTop = overflowTop;
        expandBottom = overflowBottom;

        break;
      }
    }

    // 位移补偿：始终使用 expandTop
    const compY = expandTop;

    // 1. 先按 frameWpx 计算每行的对齐起点（逻辑对齐）
    const xOffsetsFrame = sizeResultLines.map(line =>
      layout.getOffsetXRich(textStyle, frameWpx, line.width)
    );

    // 2. 用对齐后的偏移 + 行宽算出内容的左右边界
    let contentMinX = Infinity;
    let contentMaxX = -Infinity;

    for (let i = 0; i < sizeResultLines.length; i++) {
      const off = xOffsetsFrame[i] ?? 0;
      const w = sizeResultLines[i].width ?? 0; // 像素宽

      contentMinX = Math.min(contentMinX, off);
      contentMaxX = Math.max(contentMaxX, off + w);
    }

    if (!isFinite(contentMinX)) {
      contentMinX = 0;
    }
    if (!isFinite(contentMaxX)) {
      contentMaxX = 0;
    }

    // 3. 计算内容相对于 frame 的越界量
    const overflowLeft = Math.max(0, -contentMinX);               // 内容左边 < 0
    const overflowRight = Math.max(0, contentMaxX - frameWpx);    // 内容右边 > frameWpx?

    // 4. 水平扩张：对称处理，与垂直方向的 top/bottom 处理一致
    // 防止元素以中心点对称膨胀导致文本视觉偏移
    let expandLeft = overflowLeft;
    let expandRight = overflowRight;

    switch (layout.textAlign) {
      case spec.TextAlignment.left:
      case spec.TextAlignment.right: {
        const E = Math.max(overflowLeft, overflowRight);

        expandLeft = E;
        expandRight = E;

        break;
      }
      case spec.TextAlignment.middle:
      default:
        // 居中对齐时左右溢出天然对称，保持原始值
        break;
    }

    // 5. 最终 canvas 宽高
    const finalWpx = Math.ceil(frameWpx + expandLeft + expandRight);
    const finalHpx = Math.ceil(frameHpx + expandTop + expandBottom);

    // 记录补偿，供垂直对齐策略叠加
    sizeResult.baselineCompensationX = expandLeft;
    sizeResult.baselineCompensationY = compY;
    // containerWidth 用 frameWpx，而不是 finalWpx
    sizeResult.containerWidth = frameWpx;

    sizeResult.canvasWidth = finalWpx;
    sizeResult.canvasHeight = finalHpx;

    // 不进行任何缩放或裁剪
    return {
      globalScale: 1,
    };
  }
}
