import type { TextStyle } from '@galacean/effects';
import type { RichTextLayout } from '../rich-text-layout';
import type { RichTextOptions } from '../rich-text-component';

/**
 * 富文本字符详情
 */
export interface RichCharDetail {
  char: string,
  x: number,
}

/**
 * 富文本行信息
 */
export interface RichLine {
  richOptions: RichTextOptions[],
  offsetX: number[],
  width: number,
  lineHeight: number,
  offsetY: number,
  chars: RichCharDetail[][],
  lineAscent?: number,    // 行上升高度
  lineDescent?: number,   // 行下降高度
}

/**
 * 换行策略结果
 */
export interface WrapResult {
  lines: RichLine[],
  maxLineWidth: number,
  totalHeight: number,
  bboxTop?: number,         // 边界框顶部
  bboxBottom?: number,      // 边界框底部
  bboxHeight?: number,      // 边界框高度
}

/**
 * 尺寸策略结果
 */
export interface SizeResult {
  canvasWidth: number,
  canvasHeight: number,
  contentWidth?: number,       // 内容宽度
  bboxTop?: number,            // 边界框顶部
  bboxBottom?: number,         // 边界框底部
  bboxHeight?: number,         // 边界框高度
  baselineCompensationY?: number, // 基线补偿Y值（仅visible模式）
  baselineCompensationX?: number, // 基线补偿X值（仅visible模式）
  lines?: RichLine[],          // 行信息（仅visible模式）
}
/**
 * 溢出策略结果
 */
export interface OverflowResult {
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
  calculate (
    WrapResult: WrapResult,
    layout: RichTextLayout,
    style: TextStyle,
    singleLineHeight: number,
    fontScale: number
  ): SizeResult,
}

/**
 * 富文本换行策略接口
 */
export interface RichWrapStrategy {
  computeLines (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: RichTextLayout,
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
  apply (
    lines: RichLine[],
    sizeResult: SizeResult,
    layout: RichTextLayout,
    style: TextStyle,
  ): OverflowResult,
}

/**
 * 富文本水平对齐策略接口
 */
export interface RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: RichTextLayout,
    style: TextStyle,
  ): HorizontalAlignResult,
}

/**
 * 富文本垂直对齐策略接口
 */
export interface RichVerticalAlignStrategy {
  getVerticalOffsets (
    lines: RichLine[],
    sizeResult: SizeResult,
    overflowResult: OverflowResult,
    layout: RichTextLayout,
    style: TextStyle,
    singleLineHeight: number,
  ): VerticalAlignResult,
}
