import type { TextLayout } from '../text-layout';
import type { TextStyle } from '../text-style';
import type { OverflowStrategy } from './text-strategy-interfaces';

/**
 * Visible 溢出策略（默认）
 */
export class VisibleOverflowStrategy implements OverflowStrategy {
  apply (ctx: CanvasRenderingContext2D, layout: TextLayout, style: TextStyle, text: string, maxLineWidth: number): void {
    ctx.font = style.fontDesc;
  }
}