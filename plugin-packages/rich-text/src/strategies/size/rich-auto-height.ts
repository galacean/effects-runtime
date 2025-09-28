import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichSizeStrategy, SizeResult, WrapResult } from '../rich-text-interfaces';

/**
 * 富文本自动宽度尺寸策略
 * 完全基于现有Modern路径的实现逻辑：根据内容自动计算canvas尺寸
 */
export class RichAutoHeightStrategy implements RichSizeStrategy {
  private initialized = false;
  private canvasSize: { width: number, height: number } | null = null;

  calculate (
    WrapResult: WrapResult,
    layout: TextLayout,
    style: TextStyle,
    singleLineHeight: number,
    fontScale: number
  ): SizeResult {
    const { maxLineWidth, totalHeight } = WrapResult;

    if (maxLineWidth === 0 || totalHeight === 0) {
      return {
        canvasWidth: 1, // 避免零尺寸
        canvasHeight: 1,
        transformScale: { x: 1, y: 1 },
      };
    }

    // 使用实际内容尺寸（与updateTextureModern保持一致）
    const width = maxLineWidth;
    const height = totalHeight;

    // 首次渲染时初始化canvas尺寸（复制现有逻辑）
    if (!this.initialized) {
      this.canvasSize = { width, height };
      this.initialized = true;
    }

    // 后续渲染使用固定尺寸（复制现有逻辑）
    const canvasWidth = this.canvasSize ? this.canvasSize.width : width;
    const canvasHeight = this.canvasSize ? this.canvasSize.height : height;

    // 更新textLayout的宽高（复制现有逻辑）
    layout.width = canvasWidth / fontScale;
    layout.height = canvasHeight / fontScale;

    return {
      canvasWidth,
      canvasHeight,
      transformScale: { x: 1, y: 1 }, // AutoWidth不需要缩放
    };
  }

  /**
   * 重置初始化状态（用于重新计算尺寸）
   */
  reset (): void {
    this.initialized = false;
    this.canvasSize = null;
  }
}
