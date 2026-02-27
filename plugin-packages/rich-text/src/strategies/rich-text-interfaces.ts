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
 * 溢出策略结果
 * 包含最终画布尺寸和渲染坐标偏移
 */
export interface OverflowResult {
  canvasWidth: number,
  canvasHeight: number,
  /** 渲染时叠加到所有 X 坐标的偏移（帧→画布坐标系补偿） */
  renderOffsetX: number,
  /** 渲染时叠加到所有 Y 坐标的偏移（帧→画布坐标系补偿） */
  renderOffsetY: number,
}

/**
 * 水平对齐策略结果
 */
export interface HorizontalAlignResult {
  lineOffsets: number[], // 每行在帧坐标系中的水平偏移量
}

/**
 * 垂直对齐策略结果
 */
export interface VerticalAlignResult {
  baselineY: number,      // 第一行基线在帧坐标系中的 Y 坐标
  lineYOffsets: number[],  // 每行在帧坐标系中的垂直偏移量
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
    letterSpace: number,
  ): WrapResult,
}

/**
 * 富文本溢出策略接口（画布解析）
 * 根据对齐后的内容位置确定最终画布尺寸和渲染偏移
 * 不依赖对齐模式（textAlign/textVerticalAlign）的枚举值，
 * 仅使用对齐策略输出的位置数据
 */
export interface RichOverflowStrategy {
  resolveCanvas (
    lines: RichLine[],
    frameWidth: number,
    frameHeight: number,
    horizontalResult: HorizontalAlignResult,
    verticalResult: VerticalAlignResult,
  ): OverflowResult,
}

/**
 * 将行数据等比缩小以适配帧尺寸（display 模式使用）
 * 只缩小不放大，就地修改行数据
 */
export function scaleLinesToFit (
  lines: RichLine[],
  contentWidth: number,
  contentHeight: number,
  frameWidth: number,
  frameHeight: number,
): void {
  const safeDiv = (a: number, b: number) =>
    Math.abs(b) > 1e-5 ? a / b : 1;

  const safeContentW = Math.max(1, contentWidth);
  const safeContentH = Math.max(1, contentHeight);

  // 只缩小不放大
  const s = Math.min(1,
    safeDiv(frameWidth, safeContentW),
    safeDiv(frameHeight, safeContentH)
  );

  // 浮点精度处理
  if (s > 0.9999) {
    return;
  }

  for (const line of lines) {
    line.width *= s;
    line.lineHeight *= s;
    if (line.offsetX) {
      for (let i = 0; i < line.offsetX.length; i++) { line.offsetX[i] *= s; }
    }
    for (const seg of (line.chars || [])) {
      for (const ch of seg) { ch.x *= s; }
    }
    // 创建新的 richOptions 数组，避免修改原始对象
    const originalOptions = line.richOptions || [];
    const newOptions = [];

    for (let i = 0; i < originalOptions.length; i++) {
      newOptions.push({
        ...originalOptions[i],
        fontSize: originalOptions[i].fontSize * s,
      });
    }

    line.richOptions = newOptions;
    if (line.lineAscent != null) { line.lineAscent *= s; }
    if (line.lineDescent != null) { line.lineDescent *= s; }
  }
}

/**
 * 富文本水平对齐策略接口
 * 在帧坐标系中定位内容，不依赖溢出模式
 */
export interface RichHorizontalAlignStrategy {
  getHorizontalOffsets (
    lines: RichLine[],
    frameWidth: number,
    layout: RichTextLayout,
    style: TextStyle,
  ): HorizontalAlignResult,
}

/**
 * 富文本垂直对齐策略接口
 * 在帧坐标系中定位内容，不依赖溢出模式
 */
export interface RichVerticalAlignStrategy {
  getVerticalOffsets (
    lines: RichLine[],
    frameHeight: number,
    layout: RichTextLayout,
  ): VerticalAlignResult,
}
