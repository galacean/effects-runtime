import type { QCanvasViewer } from './qcanvas-viewer';
import type { IFontMetrics } from './text-metrics';
import { TextMetrics } from './text-metrics';

const genericFontFamilies = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
];

enum QTextWrapMode {
  Default,
  Clip,
  Ellipsis,
}

interface QTextOptions {
  left?: number,
  top?: number,
  maxWidth?: number,
  fontFamily?: string,
  fontSize?: number,
  fontWeight?: string,
  align?: string,
  verticalAlign?: string,
  padding?: number,
  letterSpacing?: number,
  wrap?: QTextWrapMode,
  color?: string,
  fontStyle?: string,
  angle?: number,
  name?: string,
}

interface QChar {
  left: number,
  top: number,
  char: string,
  width: number,
  heigh: number,
  font: string,
  fontSize: number,
  isEllipsis: boolean,
  scale: number,
  index: number,
}

class QText {
  // 文本框在canvas中位置
  left = 0;
  top = 0;

  // 文本框尺寸
  width?: number;
  height?: number;

  // 输入文本内容
  text: string;
  name: string;

  fontSize = 48;

  fontFamily = 'Arial';

  color = 'black';

  letterSpacing = 0;

  // 文本最大宽度
  maxLineWidth = 0;

  wrap: QTextWrapMode = QTextWrapMode.Clip;

  fontStyle: 'normal' | 'italic' | 'oblique' | 'initial' | 'inherit';

  // 文字左右对齐方式
  textAlign: 'center' | 'end' | 'left' | 'right' | 'start';

  // 文字上下对齐方式
  textBaseline: | 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top';

  // 文字缩放系数
  scaleX = 1;
  scaleY = 1;

  // 文字旋转角度
  angle = 0;

  active = true;

  padding = 0;

  fontWeight: string; //'normal' | 'bold' | 'bolder' | 'lighter' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

  chars: QChar[];

  borderColor = '#ffffffff';

  borderWidth = 1;

  fontProperties: IFontMetrics = {
    ascent: 0,
    descent: 0,
    fontSize: 0,
  };

  fontVariant = 'normal';

  private viewer: QCanvasViewer;
  // 锚点位置
  private originX: string | number = 'left';
  private originY: string | number = 'top';
  private ellipsis = '…';

  constructor (text: string, options: QTextOptions) {
    this.text = text;

    this.left = options.left ?? 0;
    this.top = options.top ?? 0;

    this.maxLineWidth = options.maxWidth ?? 0;

    this.letterSpacing = options.letterSpacing ?? 0;

    this.originX = 'left';
    this.originY = 'top';

    this.color = options.color ?? 'black';
    this.fontFamily = options.fontFamily ?? 'Arial';
    this.fontSize = options.fontSize ?? 48;

    this.wrap = options.wrap ?? QTextWrapMode.Clip;

    // @ts-expect-error
    this.fontStyle = options.fontStyle ?? 'normal';

    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';

    this.fontWeight = 'normal';

    this.angle = options.angle ?? 0;
    this.name = options.name || '';
  }

  update () {
    this.updateDimension();
  }

  render () {
    if (this.viewer === undefined) {
      return;
    }
    const ctx = this.viewer.renderContext;

    if (ctx === undefined) {
      return;
    }

    ctx.save();
    // 设置绘制文本时的坐标变换
    this.setRenderTransform(ctx);
    this.renderText(ctx);

    if (this.active) {
      this.drawBorders(ctx);
    }
    ctx.restore();
  }

  init (viewer: QCanvasViewer) {
    this.viewer = viewer;
    this.updateDimension();
  }

  getLayout () {
    const scaleX = this.viewer.scaleX;
    const scaleY = this.viewer.scaleY;

    return {
      x: this.left * scaleX,
      y: this.top * scaleY,
      // @ts-expect-error
      width: this.width * scaleX,
      // @ts-expect-error
      height: this.height * scaleY,
    };
  }

  private updateDimension () {
    const viewer = this.viewer;
    const ctx = viewer.renderContext;

    this.configTextStyle(ctx);
    this.configTextLayout(ctx);

    const font = this.getFontDesc();

    this.fontProperties = TextMetrics.measureFont(font);
    if (this.fontProperties.fontSize === 0) {
      this.fontProperties.fontSize = this.fontSize;
      this.fontProperties.ascent = this.fontSize;
    }

    const qChars = this.createCharsFromText(ctx, this.text);
    let textWithLetterSpaceWidth = 0;

    if (qChars.length > 0) {
      const lastChar = qChars[qChars.length - 1];

      textWithLetterSpaceWidth = lastChar.left + lastChar.width;
    }

    this.chars = qChars;

    // 文本加字间距宽度
    this.maxLineWidth = textWithLetterSpaceWidth;

    // 文本框宽高度自适应文本高度
    if (this.height === undefined) {
      // this.height = this.fontSize;
      this.height = this.fontProperties.fontSize;
    }

    if (this.width === undefined) {
      this.width = this.maxLineWidth;
    }
  }

  private configTextStyle (ctx: CanvasRenderingContext2D) {
    ctx.font = this.getFontDesc();
    ctx.fillStyle = this.color; // 字体颜色
  }

  private getFontDesc () {
    // build canvas api font setting from individual components. Convert a numeric this.fontSize to px
    const fontSizeString =
      typeof this.fontSize === 'number' ? `${this.fontSize}px` : this.fontSize;

    // Clean-up fontFamily property by quoting each font name
    // this will support font names with spaces
    const fontFamilies = (this.fontFamily).split(',');

    for (let i = fontFamilies.length - 1; i >= 0; i--) {
      // Trim any extra white-space
      let fontFamily = fontFamilies[i].trim();

      // Check if font already contains strings
      if (
        // eslint-disable-next-line no-useless-escape
        !/([\"\'])[^\'\"]+\1/.test(fontFamily) &&
        !genericFontFamilies.includes(fontFamily)
      ) {
        fontFamily = `"${fontFamily}"`;
      }
      fontFamilies[i] = fontFamily;
    }

    fontFamilies.push('Arial, Helvetica, sans-serif');

    return `${this.fontStyle} ${this.fontVariant} ${this.fontWeight} ${fontSizeString} ${(fontFamilies).join(',')}`;
  }

  private configTextLayout (ctx: CanvasRenderingContext2D) {
    ctx.textBaseline = this.textBaseline;
    ctx.textAlign = this.textAlign;
  }

  private setRenderTransform (ctx: CanvasRenderingContext2D) {
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(this.left, this.top);
    // ctx.rotate(this.angle);
  }

  private renderText (ctx: CanvasRenderingContext2D) {
    // 绘制起点偏移
    const x = 0;
    const y = 0;

    this.drawCharsInTextBox(ctx, {
      min: [x, y],
      // @ts-expect-error
      max: [x + this.width, y + this.height],
    });
  }

  private drawCharsInTextBox (
    ctx: CanvasRenderingContext2D,
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    const qChars = this.chars;

    let textWithLetterSpaceWidth = 0;

    if (qChars.length > 0) {
      const lastChar = qChars[qChars.length - 1];

      textWithLetterSpaceWidth = lastChar.left + lastChar.width;
    }

    const textBoxWidth = textBox.max[0] - textBox.min[0];

    let charOffset = 0;

    if ('left' === this.textAlign) {
      charOffset = 0;
    } else if ('center' === this.textAlign) {
      charOffset = 0.5 * (textBoxWidth - textWithLetterSpaceWidth);
    } else if ('right' === this.textAlign) {
      charOffset = textBoxWidth - textWithLetterSpaceWidth;
    }

    this.addOffsetToChars(qChars, charOffset);

    const charsInTextBox = this.cloneChars(
      this.clipCharsWithTextBox(qChars, textBox)
    );

    let needDrawChars = charsInTextBox;

    if (this.wrap === QTextWrapMode.Ellipsis) {
      needDrawChars = this.replaceCharWithEllipsis(
        ctx,
        charsInTextBox,
        textBox
      );

      if (needDrawChars.length === 0 && qChars.length !== 0) {
        this.addEllipsisToChars(ctx, needDrawChars, textBox);
      }
    }

    this.drawCharsFromLeft(ctx, needDrawChars);
  }

  private addEllipsisToChars (
    ctx: CanvasRenderingContext2D,
    needDrawChars: QChar[],
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    const ellipsisWidth = ctx.measureText(this.ellipsis).width;

    if (this.textAlign === 'left') {
      needDrawChars.push({
        char: this.ellipsis,
        left: textBox.min[0],
        top: 0,
        width: ellipsisWidth,
        heigh: this.height ?? 0,
        font: this.fontFamily,
        fontSize: this.fontSize,
        isEllipsis: true,
        scale: 1,
        index: 0,
      });
    } else if (this.textAlign === 'right') {
      needDrawChars.push({
        char: this.ellipsis,
        left: textBox.max[0] - ellipsisWidth,
        top: 0,
        width: ellipsisWidth,
        heigh: this.height ?? 0,
        font: this.fontFamily,
        fontSize: this.fontSize,
        isEllipsis: true,
        scale: 1,
        index: 0,
      });
    } else {
      const x = (textBox.max[0] + textBox.min[0]) * 0.5;

      needDrawChars.push({
        char: this.ellipsis,
        left: x - ellipsisWidth * 0.5,
        top: 0,
        width: ellipsisWidth,
        heigh: this.height ?? 0,
        font: this.fontFamily,
        fontSize: this.fontSize,
        isEllipsis: true,
        scale: 1,
        index: 0,
      });
    }
  }

  private createCharsFromText (ctx: CanvasRenderingContext2D, text: string) {
    const chars = text.split('');

    let x = 0;
    let y = 0;

    if (this.textBaseline === 'top') {
      y = 0;
    } else if (this.textBaseline === 'middle') {
      y += this.fontProperties.ascent * 0.5;
    } else if (this.textBaseline === 'alphabetic') {
      y += this.fontProperties.ascent;
    }

    const qChars: QChar[] = [];

    for (let i = 0; i < chars.length; ++i) {
      const char = chars[i];
      // in safari width maybe float number
      const charWidth = Math.floor(ctx.measureText(char).width);
      const charHeight = this.fontSize;

      const qChar: QChar = {
        left: x,
        top: y,
        width: charWidth,
        heigh: charHeight,
        char: char,
        font: this.fontFamily,
        fontSize: this.fontSize,
        isEllipsis: false,
        scale: 1,
        index: i,
      };

      qChars.push(qChar);

      x += charWidth + this.letterSpacing;
    }

    return qChars;
  }

  private addOffsetToChars (chars: QChar[], offset: number) {
    chars.forEach(qChar => {
      qChar.left += offset;
    });

    return chars;
  }

  private clipCharsWithTextBox (
    chars: QChar[],
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    const charsInTextBox: QChar[] = [];

    const error = 0.5;

    for (let i = 0; i < chars.length; ++i) {
      const qChar = chars[i];

      if (
        qChar.left >= textBox.min[0] &&
        qChar.left + qChar.width < textBox.max[0] + error
      ) {
        charsInTextBox.push(qChar);
      }
    }

    return charsInTextBox;
  }

  private cloneChars (chars: QChar[]) {
    return chars.map(qChar => {
      return { ...qChar };
    });
  }

  private replaceCharWithEllipsis (
    ctx: CanvasRenderingContext2D,
    qCharsInTextBox: QChar[],
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    const ellipsisWidth = ctx.measureText(this.ellipsis).width;

    if (qCharsInTextBox.length > 0) {
      if (qCharsInTextBox[0].index !== 0) {
        const ellipsisChar = { ...qCharsInTextBox[0] };

        ellipsisChar.char = this.ellipsis;
        ellipsisChar.isEllipsis = true;
        ellipsisChar.width = ellipsisWidth;
        qCharsInTextBox = this.findEllipsisPositionAndReplaceCharsFromLeft(
          qCharsInTextBox,
          ellipsisChar,
          textBox
        );
      }

      const qCharsInTextBoxLastIndex = qCharsInTextBox.length - 1;
      const qCharsLength = this.chars.length;

      if (
        qCharsInTextBox[qCharsInTextBoxLastIndex].index !==
        qCharsLength - 1
      ) {
        const ellipsisChar = { ...qCharsInTextBox[0] };

        ellipsisChar.char = this.ellipsis;
        ellipsisChar.isEllipsis = true;
        ellipsisChar.width = ellipsisWidth;
        qCharsInTextBox = this.findEllipsisPositionAndReplaceCharsFromRight(
          qCharsInTextBox,
          ellipsisChar,
          textBox
        );
      }
    }

    return qCharsInTextBox;
  }

  private findEllipsisPositionAndReplaceCharsFromLeft (
    qCharsInTextBox: QChar[],
    ellipsis: QChar,
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    let replaceIndex = 0;

    for (let i = 0; i < qCharsInTextBox.length; ++i) {
      const qChar = qCharsInTextBox[i];
      const qCharRight = qChar.left + qChar.width;

      replaceIndex = i;
      if (qCharRight - ellipsis.width >= textBox.min[0]) {
        break;
      }
    }

    const replacedChar = qCharsInTextBox[replaceIndex];

    ellipsis.left = replacedChar.left + replacedChar.width - ellipsis.width;

    for (let i = 0; i < replaceIndex + 1; ++i) {
      qCharsInTextBox.shift();
    }

    return [ellipsis].concat(qCharsInTextBox);
  }

  private findEllipsisPositionAndReplaceCharsFromRight (
    qCharsInTextBox: QChar[],
    ellipsis: QChar,
    textBox: { min: [x: number, y: number], max: [x: number, y: number] }
  ) {
    let replaceIndex = qCharsInTextBox.length - 1;

    for (let i = replaceIndex; i >= 0; --i) {
      const qChar = qCharsInTextBox[i];
      const ellipsisCharRight = qChar.left + ellipsis.width;

      replaceIndex = i;
      if (ellipsisCharRight <= textBox.max[0]) {
        break;
      }
    }

    ellipsis.left = qCharsInTextBox[replaceIndex].left;

    const qCharsLength = qCharsInTextBox.length;

    for (let i = qCharsLength - 1; i >= replaceIndex; --i) {
      qCharsInTextBox.pop();
    }

    return qCharsInTextBox.concat([ellipsis]);
  }

  private drawCharsFromLeft (ctx: CanvasRenderingContext2D, chars: QChar[]) {
    const align = ctx.textAlign || 'left';

    ctx.textAlign = 'left';

    for (let i = 0; i < chars.length; ++i) {
      const qChar = chars[i];

      ctx.fillText(qChar.char, qChar.left, qChar.top);
    }

    ctx.textAlign = align;
  }

  private drawBorders (ctx: CanvasRenderingContext2D) {
    const padding = this.padding;
    const strokeWidth = this.borderWidth;

    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth = strokeWidth;

    const w = this.width;
    const h = this.height;

    let x = 0;
    let y = 0;

    if (this.originX === 'center') {
      // @ts-expect-error
      x -= this.width / 2;
    } else if (this.originX === 'right') {
      // @ts-expect-error
      x -= this.width;
    }

    if (this.originY === 'center') {
      // @ts-expect-error
      y -= this.height / 2;
    } else if (this.originY === 'bottom') {
      // @ts-expect-error
      y -= this.height;
    }

    ctx.strokeRect(
      x + strokeWidth / 2,
      y + strokeWidth / 2,
      // @ts-expect-error
      w - strokeWidth,
      // @ts-expect-error
      h - strokeWidth
    );
  }
}

export { QText, QTextOptions, QTextWrapMode };
