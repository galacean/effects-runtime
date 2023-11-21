import * as spec from '@galacean/effects-specification';

export class TextStyle {
  /**
   * 字重
   */
  textWeight: spec.TextWeight; // ttf
  /**
   * 字体样式
   */
  fontStyle: spec.FontStyle; // ttf
  /**
   * 是否有下划线（暂时无效）
   */
  isUnderline = false; // ttf
  /**
   * 下划线高度（暂时无效）
   */
  underlineHeight = 1; // ttf
  /**
   * 是否有外描边
   */
  isOutlined = false; // both // ttf & char
  /**
   * 外描边颜色
   */
  outlineColor: spec.vec4;// both // ttf & char
  /**
   * 外描边宽度
   */
  outlineWidth = 0; // both // ttf & char
  /**
   * 是否有阴影
   */
  hasShadow = false; // ttf
  /**
   * 阴影颜色
   */
  shadowColor: spec.vec4; // ttf
  /**
   * 阴影模糊
   */
  shadowBlur: number; // ttf
  /**
   * 阴影水平偏移距离
   */
  shadowOffsetX: number; // ttf
  /**
   * 阴影高度偏移距离
   */
  shadowOffsetY: number; // ttf

  /**
   * 文本颜色
   */
  textColor: spec.vec4; // both

  /**
   * 字体大小
   */
  fontSize: number; // input fonSize // both
  // private maxFontSize = 100;

  // isSystemFontUsed = false; // both // ttf & char

  // font info // todo merge to font
  fontFamily: string; // both
  fontDesc = ''; // both

  /**
   * 字体倍数
   */
  fontScale = 2;

  readonly fontOffset = 0;

  constructor (options: spec.TextContentOptions) {
    const { textColor = [1, 1, 1, 1], fontSize = 40, outline, shadow, fontWeight = 'normal', fontStyle = 'normal', fontFamily = 'sans-serif' } = options;

    this.textColor = textColor;
    this.textWeight = fontWeight;
    this.fontStyle = fontStyle;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize; // 暂时取消字号限制 Math.min(fontSize, this.maxFontSize);

    if (outline) {
      this.isOutlined = true;
      this.outlineColor = outline.outlineColor ?? [1, 1, 1, 1];
      this.outlineWidth = outline.outlineWidth ?? 1;
      this.fontOffset += this.outlineWidth;
    }

    if (shadow) {
      this.hasShadow = true;
      this.shadowBlur = shadow.shadowBlur ?? 2;
      this.shadowColor = shadow.shadowColor ?? [0, 0, 0, 1];
      this.shadowOffsetX = shadow.shadowOffsetX ?? 0;
      this.shadowOffsetY = shadow.shadowOffsetY ?? 0;

    }

    if (this.fontStyle !== spec.FontStyle.normal) {
      // 0.0174532925 = 3.141592653 / 180
      this.fontOffset += this.fontSize * Math.tan(12 * 0.0174532925);
    }

  }
}
