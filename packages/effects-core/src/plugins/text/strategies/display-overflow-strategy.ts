import * as spec from '@galacean/effects-specification';
import type { TextLayout } from '../text-layout';
import type { TextStyle } from '../text-style';
import type { OverflowStrategy } from './text-strategy-interfaces';
import { getFontDesc } from './text-strategy-utils';

/**
 * Display 溢出策略
 */
export class DisplayOverflowStrategy implements OverflowStrategy {
  apply (ctx: CanvasRenderingContext2D, layout: TextLayout, style: TextStyle, text: string, maxLineWidth: number): void {
    // 与原始版本一致：使用包含 fontOffset 的宽度进行比较
    const width = (layout.width + style.fontOffset) * style.fontScale;
    const fontSize = style.fontSize * style.fontScale;

    if (maxLineWidth > width && layout.overflow === spec.TextOverflow.display) {
      ctx.font = getFontDesc(fontSize * width / maxLineWidth, style);
    } else {
      ctx.font = style.fontDesc;
    }
  }
}