import type { Engine } from '@galacean/effects';
import {
  effectsClass,
  glContext,
  spec,
  TextComponent,
  Texture } from '@galacean/effects';
import {
  TextLayout,
  TextStyle,
} from '@galacean/effects';
import { generateProgram } from './rich-text-parser';
import { ColorUtils } from './color-utils';

export interface RichTextOptions {
  text: string,
  fontSize: number,
  fontFamily?: string,
  fontWeight?: spec.TextWeight,
  fontStyle?: spec.FontStyle,
  fontColor?: spec.vec4,
  textStyle?: TextStyle,
  isNewLine: boolean,
}

interface RichCharInfo {
  offsetX: number[],
  /**
   * 字符参数
   */
  richOptions: RichTextOptions[],
  /**
   * 段落宽度
   */
  width: number,
  /**
   * 段落高度
   */
  lineHeight: number,
  /**
   * 字体高度
   */
  fontHeight: number,
}

let seed = 0;

@effectsClass(spec.DataType.RichTextComponent)
export class RichTextComponent extends TextComponent {
  processedTextOptions: RichTextOptions[] = [];
  private singleLineHeight: number = 1.571;
  constructor (engine: Engine) {
    super(engine);
    this.name = 'MRichText' + seed++;
  }

  private generateTextProgram (text: string) {
    const program = generateProgram((text, context) => {
      const textArr = text.split('\n');

      textArr.forEach((text, index) => {
        const options: RichTextOptions = {
          text,
          fontSize: this.textStyle.fontSize,
          isNewLine: false,
        };

        if (index > 0) {
          options.isNewLine = true;
        }
        if ('b' in context) {
          options.fontWeight = spec.TextWeight.bold;
        }

        if ('i' in context) {
          options.fontStyle = spec.FontStyle.italic;
        }

        if ('size' in context && context.size) {
          options.fontSize = parseInt(context.size, 10);
        }

        if ('color' in context && context.color) {
          options.fontColor = ColorUtils.toRGBA(context.color);
        }
        this.processedTextOptions.push(options);
      });

    });

    program(text);
  }

  override updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }
    this.generateTextProgram(this.text);
    let width = 0, height = 0;
    const { textLayout, textStyle } = this;

    const context = this.context;
    const charsInfo: RichCharInfo[] = [];
    const fontHeight = textStyle.fontSize * this.textStyle.fontScale;
    let charInfo: RichCharInfo = {
      richOptions: [],
      offsetX: [],
      width: 0,
      lineHeight: fontHeight * this.singleLineHeight,
      fontHeight,
    };

    this.processedTextOptions.forEach((options, index) => {
      const { text, isNewLine } = options;

      if (isNewLine) {
        charsInfo.push(charInfo);
        width = Math.max(width, charInfo.width);
        charInfo = {
          richOptions: [],
          offsetX: [],
          width: 0,
          lineHeight: fontHeight * this.singleLineHeight,
          fontHeight: fontHeight,
        };
        height += charInfo.lineHeight;
      }
      const textWidth = context.measureText(text).width;
      const textHeight = options.fontSize * this.singleLineHeight * this.textStyle.fontScale;

      if (textHeight > charInfo.lineHeight) {
        charInfo.lineHeight = textHeight;
        charInfo.fontHeight = options.fontSize * this.textStyle.fontScale;
      }
      charInfo.offsetX.push(charInfo.width);

      charInfo.width += textWidth * options.fontSize * this.SCALE_FACTOR * this.textStyle.fontScale;
      charInfo.richOptions.push(options);
    });
    charsInfo.push(charInfo);
    width = Math.max(width, charInfo.width);
    height += charInfo.lineHeight;
    const scale = width / height;

    this.item.transform.size.set(textStyle.fontSize * this.SCALE_FACTOR, textStyle.fontSize * this.SCALE_FACTOR * scale);
    this.textLayout.width = width;
    this.textLayout.height = height;
    this.canvas.width = width ;
    this.canvas.height = height;
    context.clearRect(0, 0, width, height);
    // fix bug 1/255
    context.fillStyle = `rgba(255, 255, 255, ${this.ALPHA_FIX_VALUE})`;
    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }
    let charsLineHeight = 0;

    charsInfo.forEach((charInfo, index) => {
      const { richOptions, offsetX } = charInfo;
      const x = textLayout.getOffsetX(textStyle, charInfo.width);

      charsLineHeight += charInfo.lineHeight / 2 + (charInfo.lineHeight - charInfo.fontHeight) / 2;

      richOptions.forEach((options, index) => {
        const { fontScale, textColor, fontFamily: textFamily, textWeight, fontStyle: richStyle } = textStyle;
        const { text, fontSize, fontColor = textColor, fontFamily = textFamily, fontWeight = textWeight, fontStyle = richStyle } = options;

        context.font = `${fontStyle} ${fontWeight} ${fontSize * fontScale}px ${fontFamily}`;
        context.fillStyle = `rgba(${fontColor[0]}, ${fontColor[1]}, ${fontColor[2]}, ${fontColor[3]})`;

        context.fillText(text, offsetX[index] + x, charsLineHeight);
      });
    });

    //与 toDataURL() 两种方式都需要像素读取操作
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    this.material.setTexture('uSampler0',
      Texture.createWithData(
        this.engine,
        {
          data: new Uint8Array(imageData.data),
          width: imageData.width,
          height: imageData.height,
        },
        {
          flipY,
          magFilter: glContext.LINEAR,
          minFilter: glContext.LINEAR,
          wrapS: glContext.CLAMP_TO_EDGE,
          wrapT: glContext.CLAMP_TO_EDGE,
        },
      ),
    );

    this.isDirty = false;
  }

  override updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.text = options.text ? options.text.toString() : '';
  }

}
