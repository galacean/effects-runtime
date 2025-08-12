import * as spec from '@galacean/effects-specification';
import type { TextStyle } from './text-style';

export class TextLayout {
  // Layout common
  textBaseline: spec.TextBaseline; // Enum
  textAlign: spec.TextAlignment; // Enum
  letterSpace: number;
  lineGap: number;
  overflow: spec.TextOverflow;// Enum  // both

  width = 0;
  height = 0;

  /**
   * 自适应宽高开关
   */
  autoWidth: boolean;

  readonly maxTextWidth: number;
  /**
   * 行高
   */
  lineHeight: number;

  constructor (options: spec.TextContentOptions) {
    const { textHeight = 100, textWidth = 100, textOverflow = spec.TextOverflow.clip, textBaseline = spec.TextBaseline.top, textAlign = spec.TextAlignment.left, text = ' ', letterSpace = 0, lineGap = 0.571, autoWidth = false, fontSize, lineHeight = fontSize } = options;

    const tempWidth = fontSize + letterSpace;

    this.autoWidth = autoWidth;
    this.maxTextWidth = text.length * tempWidth;

    this.width = textWidth;
    this.height = textHeight;

    this.letterSpace = letterSpace;
    this.lineGap = lineGap;
    this.overflow = textOverflow;
    this.textBaseline = textBaseline;
    this.textAlign = textAlign;
    this.lineHeight = lineHeight;
  }

  /**
   * 获取初始的行高偏移值
   * @param style - 字体基础数据
   * @param lineCount - 渲染行数
   * @param lineHeight - 渲染时的字体行高
   * @param fontSize - 渲染时的字体大小
   * @returns - 行高偏移值
   */
  getOffsetY (style: TextStyle, lineCount: number, lineHeight: number, fontSize: number) {
    const { outlineWidth, fontScale } = style;
    // /3 计算Y轴偏移量，以匹配编辑器行为
    const offsetY = (lineHeight - fontSize) / 3;
    // 计算基础偏移量
    const baseOffset = fontSize + outlineWidth * fontScale;
    const commonCalculation = lineHeight * (lineCount - 1);
    let offsetResult = 0;

    switch (this.textBaseline) {
      case spec.TextBaseline.top:
        offsetResult = baseOffset + offsetY;

        break;
      case spec.TextBaseline.middle:
        offsetResult = (this.height * fontScale - commonCalculation + baseOffset) / 2;

        break;
      case spec.TextBaseline.bottom:
        offsetResult = (this.height * fontScale - commonCalculation) - offsetY;

        break;
      default:
        break;
    }

    return offsetResult;
  }

  getOffsetX (style: TextStyle, maxWidth: number) {
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
   * 设置文本框的宽度和高度
   * @param width 文本框宽度
   * @param height 文本框高度
   */
  setSize (width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
