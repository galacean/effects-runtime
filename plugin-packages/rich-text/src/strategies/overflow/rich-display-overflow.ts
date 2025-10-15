import { math } from '@galacean/effects';
import type { TextStyle, TextLayout } from '@galacean/effects';
import type { RichLine, OverflowResult, SizeResult } from '../rich-text-interfaces';
import type { RichOverflowStrategy } from '../rich-text-interfaces';

/**
 * 富文本Display溢出策略
 * 完全基于现有Modern路径的实现逻辑：按行级缩放适配canvas宽度
 */
export class RichDisplayOverflowStrategy implements RichOverflowStrategy {
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle,
  ): OverflowResult {
    let globalScale: number = 1;
    const contentSize = sizeResult;
    const availableSize = new math.Vector2(layout.maxTextWidth, layout.maxTextHeight);

    //display模式下，计算宽高的缩放比例
    globalScale = Math.min(availableSize.x / contentSize.canvasWidth, availableSize.y / contentSize.canvasHeight);

    return { globalScale };
  }
}
