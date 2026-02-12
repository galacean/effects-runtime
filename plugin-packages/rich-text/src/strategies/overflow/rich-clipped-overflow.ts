import type { TextStyle } from '@galacean/effects';
import type { RichLine, RichOverflowStrategy, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { RichTextLayout } from '../../rich-text-layout';

/**
 * Clip 溢出策略
 * 超出画布部分自然裁切
 */
export class RichClippedOverflowStrategy implements RichOverflowStrategy {
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

    // 直接使用 frame 尺寸作为画布尺寸
    sizeResult.canvasWidth = frameWpx;
    sizeResult.canvasHeight = frameHpx;

    // clip 模式不需要任何补偿
    sizeResult.baselineCompensationX = 0;
    sizeResult.baselineCompensationY = 0;

    // 把 layout 的尺寸更新为 frame 尺寸
    layout.width = frameW;
    layout.height = frameH;

    // 不进行任何缩放，直接返回单位缩放系数
    return {
      globalScale: 1,
    };
  }
}
