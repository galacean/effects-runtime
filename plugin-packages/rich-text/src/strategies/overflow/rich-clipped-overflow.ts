import type {
  RichLine, RichOverflowStrategy, OverflowResult,
  HorizontalAlignResult, VerticalAlignResult,
} from '../rich-text-interfaces';

/**
 * Clip 溢出策略
 * 画布尺寸固定为帧尺寸，超出部分自然裁切
 * 不依赖对齐模式
 */
export class RichClippedOverflowStrategy implements RichOverflowStrategy {
  resolveCanvas (
    lines: RichLine[],
    frameWidth: number,
    frameHeight: number,
    horizontalResult: HorizontalAlignResult,
    verticalResult: VerticalAlignResult,
  ): OverflowResult {
    return {
      canvasWidth: Math.max(1, Math.ceil(frameWidth)),
      canvasHeight: Math.max(1, Math.ceil(frameHeight)),
      renderOffsetX: 0,
      renderOffsetY: 0,
    };
  }
}
