import * as spec from '@galacean/effects-specification';
import type { TextStyle } from './text-style';
import type { BaseLayout } from './base-layout';

export class TextLayout implements BaseLayout {
  textVerticalAlign: spec.TextVerticalAlign;
  textAlign: spec.TextAlignment;
  letterSpace: number;
  overflow: spec.TextOverflow;
  width = 0;
  height = 0;
  /**
   * 行高
   */
  lineHeight: number;
  /**
   * 自动宽高模式
   */
  autoResize = spec.TextSizeMode.fixed;
  /**
   * 是否启用单词完整换行（不从单词中间断开）
   * - true: 优先在空格处换行，保持单词完整性
   * - false: 允许在任意字符处换行（逐字符换行）
   * @default true
   */
  wordBreak = true;

  constructor (options: spec.TextContentOptions) {
    this.update(options);
  }

  update (options: spec.TextContentOptions): void {
    const {
      textHeight = 100,
      textWidth = 100,
      textOverflow = spec.TextOverflow.clip,
      textVerticalAlign = spec.TextVerticalAlign.top,
      textAlign = spec.TextAlignment.left,
      letterSpace = 0,
      fontSize,
      lineHeight = fontSize,
      autoResize = spec.TextSizeMode.fixed,
    } = options;

    this.letterSpace = letterSpace;
    this.overflow = textOverflow;
    this.textVerticalAlign = textVerticalAlign;
    this.textAlign = textAlign;
    this.width = textWidth;
    this.height = textHeight;
    this.autoResize = autoResize;

    this.lineHeight = lineHeight;
  }

  /**
   * 获取初始的行高偏移值
   * @param style - 字体基础数据
   * @param lineCount - 渲染行数
   * @param lineHeight - 渲染时的字体行高
   * @param fontSize - 渲染时的字体大小
   * @param totalLineHeight - 可选的实际总行高，用于替代默认计算
   * @returns - 行高偏移值
   */
  getOffsetY (style: TextStyle, lineCount: number, lineHeight: number, fontSize: number, totalLineHeight?: number) {
    // /3 计算Y轴偏移量，以匹配编辑器行为
    const offsetY = (lineHeight - fontSize) / 3;
    // 计算基础偏移量
    const baseOffset = fontSize;
    const commonCalculation = totalLineHeight !== undefined ? totalLineHeight : lineHeight * (lineCount - 1);
    let offsetResult = 0;

    switch (this.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
        offsetResult = baseOffset + offsetY;

        break;
      case spec.TextVerticalAlign.middle:
        offsetResult = (this.height - commonCalculation + baseOffset) / 2;

        break;
      case spec.TextVerticalAlign.bottom:
        offsetResult = (this.height - commonCalculation) - offsetY;

        break;
      default:
        break;
    }

    return offsetResult;
  }

  /**
   * 获取初始的水平偏移值
   * @param style - 字体基础数据
   * @param maxWidth - 最大行宽
   * @returns - 水平偏移值
   */
  getOffsetX (style: TextStyle, maxWidth: number) {
    let offsetX = 0;

    switch (this.textAlign) {
      case spec.TextAlignment.left:
        offsetX = 0;

        break;
      case spec.TextAlignment.middle:
        offsetX = (this.width - maxWidth) / 2;

        break;
      case spec.TextAlignment.right:
        offsetX = (this.width - maxWidth);

        break;
      default:
        break;
    }

    return offsetX;
  }

  /**
   * 设置文本框的宽度和高度
   * @param width - 文本框宽度
   * @param height - 文本框高度
   */
  setSize (width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}