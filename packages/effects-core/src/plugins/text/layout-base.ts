import type * as spec from '@galacean/effects-specification';
import type { TextStyle } from './text-style';

export interface LayoutBase {
  textBaseline: spec.TextBaseline,
  textAlign: spec.TextAlignment,
  letterSpace: number,
  overflow: spec.TextOverflow,
  width: number,
  height: number,

  setSize(width: number, height: number): void,
  getOffsetY(
    style: TextStyle,
    lineCount: number,
    lineHeight: number,
    fontSize: number,
    totalLineHeight?: number
  ): number,
  getOffsetX(style: TextStyle, maxWidth: number): number,
}
