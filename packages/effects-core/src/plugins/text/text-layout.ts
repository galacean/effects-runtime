import * as spec from '@galacean/effects-specification';
import type { TextStyle } from './text-style';

export class TextLayout {

  // Layout common
  textBaseline: spec.TextBaseline; // Enum
  textAlign: spec.TextAlignment; // Enum
  letterSpace: number;
  overFlow: spec.TextOverflow;// Enum  // both

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
    const { textHeight = 100, textWidth = 100, textOverflow = spec.TextOverflow.display, textBaseline = spec.TextBaseline.top, textAlign = spec.TextAlignment.left, text, letterSpace = 0, autoWidth = false, fontSize, lineHeight = fontSize } = options;

    const tempWidth = fontSize + letterSpace;

    this.autoWidth = autoWidth;
    this.maxTextWidth = text.length * tempWidth;

    // if (autoWidth) {
    //   this.width = this.maxTextWidth + this.lineWidth;
    //   this.height = fontSize + this.lineHeight;
    // } else {
    //   if (textWidth) {
    //     this.maxCharCount = Math.floor((textWidth - this.lineWidth) / (tempWidth));
    //     this.width = textWidth;
    //   } else {
    //     this.width = basicScale[0] * 100;
    //   }
    //   this.height = basicScale[1] * 100;
    // }

    this.width = textWidth;
    this.height = textHeight;

    this.letterSpace = letterSpace;
    this.overFlow = textOverflow;
    this.textBaseline = textBaseline;
    this.textAlign = textAlign;
    this.lineHeight = lineHeight;
  }

  getOffsetY (style: TextStyle) {
    let offsetY = 0;
    const offset = (style.fontSize + style.outlineWidth) * style.fontScale ;

    switch (this.textBaseline) {
      case spec.TextBaseline.top:
        offsetY = offset;

        break;
      case spec.TextBaseline.middle:
        offsetY = (this.height + offset) / 2; // fonSize;

        break;
      case spec.TextBaseline.bottom:
        offsetY = this.height - offset / 2;

        break;
      default:
        break;
    }

    return offsetY;
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

        offsetX = (this.width * style.fontScale - maxWidth) ;

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
