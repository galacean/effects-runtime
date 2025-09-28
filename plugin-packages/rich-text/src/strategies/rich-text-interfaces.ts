import type { TextLayout } from '@galacean/effects';
import type { TextStyle } from '@galacean/effects';
import type { RichTextOptions } from '../rich-text-component';

/**
 * 富文本字符详情（与现有实现保持一致）
 */
export interface RichCharDetail {
  char: string,
  x: number,
  width: number,
}

/**
 * 富文本行信息（与现有实现保持一致）
 */
export interface RichLine {
  richOptions: RichTextOptions[],
  offsetX: number[],
  width: number,
  lineHeight: number,
  offsetY: number,
  chars: RichCharDetail[][],
}

/**
 * 换行策略结果
 */
export interface WrapResult {
  lines: RichLine[],
  maxLineWidth: number,
  totalHeight: number,
}

/**
 * 尺寸策略结果
 */
export interface SizeResult {
  canvasWidth: number,
  canvasHeight: number,
  transformScale: { x: number, y: number },
}

/**
 * 溢出策略结果
 */
export interface OverflowResult {
  lineScales?: number[],
  globalScale?: number,
}

/**
 * 水平对齐策略结果
 */
export interface HorizontalAlignResult {
  lineOffsets: number[], // 每行的水平偏移量
}

/**
 * 垂直对齐策略结果
 */
export interface VerticalAlignResult {
  baselineY: number, // 第一行基线Y坐标
  lineYOffsets: number[], // 每行的垂直偏移量
}

/**
 * 对齐策略结果（组合水平和垂直对齐）
 */
export interface AlignResult {
  horizontal: HorizontalAlignResult,
  vertical: VerticalAlignResult,
}

/**
 * 富文本尺寸策略接口
 */
export interface RichSizeStrategy {
  calculate(
    WrapResult: WrapResult,
    layout: TextLayout,
    style: TextStyle,
    singleLineHeight: number,
    fontScale: number
  ): SizeResult,
}

/**
 * 富文本换行策略接口
 */
export interface RichWrapStrategy { // 更新接口名
  computeLines(
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: TextLayout,
    singleLineHeight: number,
    fontScale: number,
    letterSpace: number,
    scaleFactor: number
  ): WrapResult,
}

/**
 * 富文本溢出策略接口
 */
export interface RichOverflowStrategy {
  apply(
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: TextLayout,
    style: TextStyle,
  ): OverflowResult,
}

/**
 * 富文本水平对齐策略接口
 */
export interface RichHorizontalAlignStrategy {
  getHorizontalOffsets(
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: TextLayout,
    style: TextStyle,
  ): HorizontalAlignResult,
}

/**
 * 富文本垂直对齐策略接口
 */
export interface RichVerticalAlignStrategy {
  getVerticalOffsets(
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: TextLayout,
    style: TextStyle,
    singleLineHeight: number,
  ): VerticalAlignResult,
}
