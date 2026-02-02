import type { SdfTextLine } from './sdf/line';
import type { SdfGlyph } from './sdf/glyph';
import type { Vector2Like } from '@galacean/effects-math/es/core/type';

export interface ISdfTextParagraphMetrics {
  /** @internal */
  readonly paragraph: string,
  /** @internal */
  readonly lines: SdfTextLine[],
  /** @internal */
  readonly width: number,
  /** @internal */
  readonly height: number,
  /** @internal */
  readonly glyphs: SdfGlyph[],
}

/**
 * 水平对齐方式
 * @internal
 */
export type HorizontalAlign = 'left' | 'right' | 'center';

/**
 * 垂直对齐方式
 * @internal
 */
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/** @internal */
export type ParagraphOptions = {
  maxWidth: number,
  lineHeight: number,
  letterSpacing: number,
  tabSize: number,
  whiteSpace: /* 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | */ 'pre-line' /* | 'break-spaces'*/,
  translate: Vector2Like | undefined,
  customLayoutEngine?: (text: string, options: ParagraphOptions) => ISdfTextParagraphMetrics,
  /**
   * 是否启用自动换行
   * @default true
   */
  wordWrap?: boolean,
  /**
   * 水平对齐方式
   * @default 'center'
   */
  horizontalAlign?: HorizontalAlign,
  /**
   * 垂直对齐方式
   * @default 'middle'
   */
  verticalAlign?: VerticalAlign,
  /**
   * 容器高度，用于垂直对齐计算
   * 如果不设置，则使用文本实际高度
   */
  maxHeight?: number,
};

/** @internal */
export const DefaultParagraphOptions: ParagraphOptions = {
  maxWidth: Infinity,
  lineHeight: 1,
  letterSpacing: 1,
  tabSize: 4,
  whiteSpace: 'pre-line',
  translate: { x: -0.5, y: -0.5 },
  wordWrap: true,
  horizontalAlign: 'center',
  verticalAlign: 'middle',
};
