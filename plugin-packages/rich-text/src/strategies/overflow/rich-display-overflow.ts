
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
    lines.forEach(line => {
      line.width *= s;
      line.lineHeight *= s;

      // 缩放段落偏移
      if (line.offsetX) {
        for (let i = 0; i < line.offsetX.length; i++) {
          line.offsetX[i] *= s;
        }
      }

      // 缩放字符级几何
      if (line.chars) {
        for (const seg of line.chars) {
          for (const ch of seg) {
            ch.x *= s;
            ch.width *= s;
          }
        }
      }

      // 缩放富文本选项中的字体大小
      if (line.richOptions) {
        for (const option of line.richOptions) {
          option.fontSize *= s;
        }
      }
    });

    return { globalScale: s };
  }
}
