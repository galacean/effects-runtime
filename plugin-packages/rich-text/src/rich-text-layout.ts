import { spec } from '@galacean/effects';
import type { TextStyle, LayoutBase } from '@galacean/effects';
export class RichTextLayout implements LayoutBase {
  textVerticalAlign: spec.TextVerticalAlign;
  textAlign: spec.TextAlignment;
  letterSpace: number;
  overflow: spec.TextOverflow;
  width = 0;
  height = 0;

  /**
   * 是否使用旧版富文本渲染
   */
  useLegacyRichText: boolean;

  /**
   * 文本框是否开启自动换行
   */
  wrapEnabled: boolean;

  /**
   * 文本框最大宽度限制
   */
  maxTextWidth: number;

  /**
   * 文本框最大高度限制
   */
  maxTextHeight: number;

  /**
   * 文本框大小模式
   */
  sizeMode: spec.TextSizeMode;

  /**
   * 文本行高
   */
  lineHeight: number;

  constructor (options: spec.RichTextContentOptions) {
    const {
      size,
      textOverflow = spec.TextOverflow.clip,
      textVerticalAlign = spec.TextVerticalAlign.middle,
      textAlign = spec.TextAlignment.left,
      letterSpace = 0,
      lineHeight = 0.571,
      wrapEnabled = false,
      maxTextWidth = 350,
      maxTextHeight = 1000,
      sizeMode = spec.TextSizeMode.autoWidth,
      // @ts-expect-error 兼容旧版
      useLegacyRichText = false,
    } = options;

    this.letterSpace = letterSpace;
    this.lineHeight = lineHeight * 300;
    this.useLegacyRichText = useLegacyRichText;
    this.overflow = textOverflow;
    this.textVerticalAlign = textVerticalAlign;
    this.textAlign = textAlign;
    this.width = size ? size[0] : 100;
    this.height = size ? size[1] : 100;

    this.wrapEnabled = wrapEnabled;
    this.maxTextWidth = maxTextWidth;
    this.maxTextHeight = maxTextHeight;
    this.sizeMode = sizeMode;
  }

  getOffsetY (style: TextStyle, lineCount: number, lineHeight: number, fontSize: number, totalLineHeight?: number): number {
    const { outlineWidth, fontScale } = style;
    // /3 计算Y轴偏移量，以匹配编辑器行为
    const offsetY = (lineHeight - fontSize) / 3;
    // 计算基础偏移量
    const baseOffset = fontSize + outlineWidth * fontScale;
    const commonCalculation = totalLineHeight !== undefined ? totalLineHeight : lineHeight * (lineCount - 1);
    let offsetResult = 0;

    switch (this.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
        offsetResult = baseOffset + offsetY;

        break;
      case spec.TextVerticalAlign.middle:
        offsetResult = (this.height * fontScale - commonCalculation + baseOffset) / 2;

        break;
      case spec.TextVerticalAlign.bottom:
        offsetResult = (this.height * fontScale - commonCalculation) - offsetY;

        break;
      default:
        break;
    }

    return offsetResult;
  }

  getOffsetX (style: TextStyle, maxWidth: number): number {
    let offsetX = 0;

    switch (this.textAlign) {
      case spec.TextAlignment.left:
        offsetX = style.outlineWidth * style.fontScale;

        break;
      case spec.TextAlignment.middle:
        offsetX = (this.width * style.fontScale - maxWidth) / 2;

        break;
      case spec.TextAlignment.right:
        offsetX = (this.width * style.fontScale - maxWidth);

        break;
      default:
        break;
    }

    return offsetX;
  }

  /**
   * 富文本垂直对齐计算
   * @param style - 字体样式
   * @param lineHeights - 每行高度数组
   * @param fontSize - 字体大小
   * @returns 第一行基线的Y坐标
   */
  getOffsetYRich (style: TextStyle, lineHeights: number[], fontSize: number): number {
    const { outlineWidth, fontScale } = style;
    const total = lineHeights.reduce((a, b) => a + b, 0);
    const offsetY = (lineHeights[0] - fontSize) / 3;
    const baseOffset = fontSize + outlineWidth * fontScale;
    const commonCalculation = total - lineHeights[0];
    let offsetResult = 0;

    switch (this.textVerticalAlign) {
      case spec.TextVerticalAlign.top:
        offsetResult = baseOffset + offsetY;

        break;
      case spec.TextVerticalAlign.middle:
        offsetResult = (this.height * fontScale - total) / 2 + baseOffset;

        break;
      case spec.TextVerticalAlign.bottom:
        offsetResult = (this.height * fontScale - commonCalculation) - offsetY;

        break;
      default:
        break;
    }

    return offsetResult;
  }

  /**
   * 富文本横向对齐计算
   * @param style - 字体样式
   * @param maxWidth - 文本框最大宽度
   * @param contentW - 文本实际宽度
   * @returns 水平偏移量
   */
  getOffsetXRich (style: TextStyle, maxWidth: number, contentW: number): number {
    switch (this.textAlign) {
      case spec.TextAlignment.left:
        return style.outlineWidth;
      case spec.TextAlignment.middle:
        return (maxWidth - contentW) / 2;
      case spec.TextAlignment.right:
        return maxWidth - contentW;
      default:
        return 0;
    }
  }

  setSize (width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
