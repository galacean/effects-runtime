
import type { TextStyle, TextLayout } from '@galacean/effects';
import type { RichLine, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { RichOverflowStrategy } from '../rich-text-interfaces';

/**
 * 富文本Display溢出策略
 * 在溢出策略中对所有几何量进行一次性缩放
 */
export class RichDisplayOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle,
  ): OverflowResult {
    // 安全处理除零情况
    const safeDiv = (a: number, b: number) =>
      Math.abs(b) > 1e-5 ? a / b : 1;

    const availableW = Math.max(1, layout.maxTextWidth || sizeResult.canvasWidth);
    const availableH = Math.max(1, layout.maxTextHeight || sizeResult.canvasHeight);
    const contentW = Math.max(1, sizeResult.canvasWidth);
    const contentH = Math.max(1, sizeResult.canvasHeight);

    // 只缩小不放大
    const s = Math.min(1,
      safeDiv(availableW, contentW),
      safeDiv(availableH, contentH)
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
        for (let i = 0; i < line.offsetX.length; i++) {line.offsetX[i] *= s;}
      }
      for (const seg of (line.chars || [])) {
        for (const ch of seg) { ch.x *= s; ch.width *= s; }
      }
      for (const opt of (line.richOptions || [])) {
        opt.fontSize *= s;         // 缩小字形
      }
    }

    return { globalScale: s };
  }
}
