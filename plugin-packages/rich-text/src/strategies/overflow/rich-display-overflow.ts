
import type { TextStyle } from '@galacean/effects';
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
    // 安全处理除零情况
    const safeDiv = (a: number, b: number) =>
      Math.abs(b) > 1e-5 ? a / b : 1;

    // 用像素空间计算
    const frameWpx = layout.maxTextWidth * style.fontScale;
    const frameHpx = layout.maxTextHeight * style.fontScale;

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
    for (const line of lines) {
      line.width *= s;
      line.lineHeight *= s;        // 缩小行距（你的 gap-only 模式行高=gapPx）
      if (line.offsetX) {
        for (let i = 0; i < line.offsetX.length; i++) { line.offsetX[i] *= s; }
      }
      for (const seg of (line.chars || [])) {
        for (const ch of seg) { ch.x *= s; }
      }
      for (const opt of (line.richOptions || [])) {
        opt.fontSize *= s;         // 缩小字形
      }
      // 同步缩放 asc/desc
      if (line.lineAscent != null) { line.lineAscent *= s; }
      if (line.lineDescent != null) { line.lineDescent *= s; }
    }

    return { globalScale: s };
  }
}
