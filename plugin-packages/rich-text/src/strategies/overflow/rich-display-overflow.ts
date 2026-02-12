
import { spec, type TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichLine, OverflowResult, SizeResult, RichOverflowStrategy } from '../rich-text-interfaces';

/**
 * 富文本 Display 溢出策略
 * 在溢出策略中对所有几何量进行一次性缩放
 */
export class RichDisplayOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: RichTextLayout,
    style: TextStyle,
  ): OverflowResult {
    const textStyle = style;
    const fontScale = textStyle.fontScale || 1;

    const frameW = layout.maxTextWidth;
    const frameH = layout.maxTextHeight;

    // display 模式：内容已被溢出策略缩放至 frame 内，
    // 画布不做水平扩张。
    // 仅当 lineHeight < 文字高度时，垂直方向可能有少量字形溢出需补偿。
    const frameWpx = frameW * fontScale;
    const frameHpx = frameH * fontScale;

    const bboxTop = sizeResult.bboxTop ?? 0;
    const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
    const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

    // 计算 frame 基线（用于检测字形垂直溢出）
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

    const sizeResultLines = sizeResult.lines || [];
    const baselines: number[] = [];

    for (let i = 0; i < sizeResultLines.length; i++) {
      baselines[i] = i === 0 ? 0 : baselines[i - 1] + (sizeResultLines[i].lineHeight || 0);
    }

    // 计算实际字形渲染范围（baseline ± ascent/descent）
    let glyphTopInFrame = baselineYFrame;
    let glyphBottomInFrame = baselineYFrame;

    for (let i = 0; i < sizeResultLines.length; i++) {
      const asc = sizeResultLines[i].lineAscent ?? 0;
      const desc = sizeResultLines[i].lineDescent ?? 0;

      glyphTopInFrame = Math.min(glyphTopInFrame, baselineYFrame + baselines[i] - asc);
      glyphBottomInFrame = Math.max(glyphBottomInFrame, baselineYFrame + baselines[i] + desc);
    }

    const contentTopInFrame = Math.min(baselineYFrame + bboxTop, glyphTopInFrame);
    const contentBottomInFrame = Math.max(baselineYFrame + bboxBottom, glyphBottomInFrame);

    const overflowTop = Math.max(0, -contentTopInFrame);
    const overflowBottom = Math.max(0, contentBottomInFrame - frameHpx);

    // 垂直扩张：对称处理，防止元素中心点偏移
    let expandTop = overflowTop;
    let expandBottom = overflowBottom;

    switch (layout.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
      case spec.TextVerticalAlign.bottom: {
        const E = Math.max(overflowTop, overflowBottom);

        expandTop = E;
        expandBottom = E;

        break;
      }
      case spec.TextVerticalAlign.middle: {
        expandTop = overflowTop;
        expandBottom = overflowBottom;

        break;
      }
    }

    const compY = expandTop;
    const finalHpx = Math.ceil(frameHpx + expandTop + expandBottom);

    // 水平不扩张，直接用 frame 宽度
    sizeResult.canvasWidth = frameWpx;
    sizeResult.canvasHeight = finalHpx;

    sizeResult.baselineCompensationX = 0;
    sizeResult.baselineCompensationY = compY;

    layout.width = frameW;
    layout.height = frameH;

    // 安全处理除零情况
    const safeDiv = (a: number, b: number) =>
      Math.abs(b) > 1e-5 ? a / b : 1;

    const contentWpx = Math.max(1, sizeResult.contentWidth ?? sizeResult.canvasWidth);
    const contentHpx = Math.max(1, sizeResult.bboxHeight ?? sizeResult.canvasHeight);

    // 只缩小不放大（基于像素空间计算）
    const s = Math.min(1,
      safeDiv(frameWpx, contentWpx),
      safeDiv(frameHpx, contentHpx)
    );

    // 浮点精度处理
    if (s > 0.9999) {
      return { globalScale: 1 };
    }

    // 统一缩放所有几何量
    for (const line of sizeResultLines) {
      line.width *= s;
      line.lineHeight *= s;        // 缩小行距（你的 gap-only 模式行高=gapPx）
      if (line.offsetX) {
        for (let i = 0; i < line.offsetX.length; i++) { line.offsetX[i] *= s; }
      }
      for (const seg of (line.chars || [])) {
        for (const ch of seg) { ch.x *= s; }
      }
      // 创建新的 richOptions 数组，避免修改原始对象
      const originalOptions = line.richOptions || [];
      const newOptions = [];

      for (let i = 0; i < originalOptions.length; i++) {
        newOptions.push({
          ...originalOptions[i],
          fontSize: originalOptions[i].fontSize * s,  // 缩小字形
        });
      }

      line.richOptions = newOptions;
      // 同步缩放 asc/desc
      if (line.lineAscent != null) { line.lineAscent *= s; }
      if (line.lineDescent != null) { line.lineDescent *= s; }
    }

    return { globalScale: s };
  }
}
