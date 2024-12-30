import type { Engine } from '@galacean/effects';
import { assertExist, math } from '@galacean/effects';
import { effectsClass, glContext, spec, TextComponent, Texture, TextLayout, TextStyle } from '@galacean/effects';
import { generateProgram } from './rich-text-parser';
import { toRGBA } from './color-utils';

/**
 *
 */
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
   * 字体偏移高度
   */
  offsetY: number,
}

let seed = 0;

@effectsClass(spec.DataType.RichTextComponent)
export class RichTextComponent extends TextComponent {
  processedTextOptions: RichTextOptions[] = [];

  private singleLineHeight: number = 1.571;
  private size: math.Vector2 | null = null;
  /**
   * 获取第一次渲染的 size
   */
  private initialized: boolean = false;
  /**
   * canvas 大小
   */
  private canvasSize: math.Vector2 | null = null;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MRichText' + seed++;
  }

  private generateTextProgram (text: string) {
    this.processedTextOptions = [];
    const program = generateProgram((text, context) => {
      // 如果富文本仅包含换行符，则在每个换行符后添加一个空格
      if (/^\n+$/.test(text)) {
        text = text.replace(/\n/g, '\n ');
      }
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
          options.fontColor = toRGBA(context.color);
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
    const { overflow } = textLayout;
    const context = this.context;

    context.save();

    const charsInfo: RichCharInfo[] = [];
    const fontHeight = textStyle.fontSize * this.textStyle.fontScale;
    let charInfo: RichCharInfo = {
      richOptions: [],
      offsetX: [],
      width: 0,
      lineHeight: fontHeight * this.singleLineHeight,
      offsetY: fontHeight * (this.singleLineHeight - 1) / 2,
    };

    this.processedTextOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      if (isNewLine) {
        charsInfo.push(charInfo);
        width = Math.max(width, charInfo.width);
        charInfo = {
          richOptions: [],
          offsetX: [],
          width: 0,
          lineHeight: fontHeight * this.singleLineHeight,
          offsetY: fontHeight * (this.singleLineHeight - 1) / 2,
        };
        height += charInfo.lineHeight;
      }
      //恢复默认设置
      context.font = `10px ${options.fontFamily || textStyle.fontFamily}`;
      const textWidth = context.measureText(text).width;
      const textHeight = fontSize * this.singleLineHeight * this.textStyle.fontScale;

      if (textHeight > charInfo.lineHeight) {
        height += textHeight - charInfo.lineHeight;

        charInfo.lineHeight = textHeight;
        charInfo.offsetY = fontSize * this.textStyle.fontScale * (this.singleLineHeight - 1) / 2;
      }
      charInfo.offsetX.push(charInfo.width);

      charInfo.width += textWidth * fontSize * this.SCALE_FACTOR * this.textStyle.fontScale;
      charInfo.richOptions.push(options);
    });
    charsInfo.push(charInfo);
    width = Math.max(width, charInfo.width);
    height += charInfo.lineHeight;
    if (width === 0 || height === 0) {
      this.isDirty = false;

      return;
    }

    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    if (!this.initialized) {
      this.canvasSize = new math.Vector2(width, height);
      this.item.transform.size.set(x * width * this.SCALE_FACTOR * this.SCALE_FACTOR, y * height * this.SCALE_FACTOR * this.SCALE_FACTOR);
      this.size = this.item.transform.size.clone();
      this.initialized = true;
    }
    assertExist(this.canvasSize);
    const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

    this.textLayout.width = canvasWidth / textStyle.fontScale;
    this.textLayout.height = canvasHeight / textStyle.fontScale;
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    // fix bug 1/255
    context.fillStyle = `rgba(255, 255, 255, ${this.ALPHA_FIX_VALUE})`;
    if (!flipY) {
      context.translate(0, canvasHeight);
      context.scale(1, -1);
    }

    if (charsInfo.length === 0) {
      return;
    }
    let charsLineHeight = textLayout.getOffsetY(textStyle, charsInfo.length, fontHeight * this.singleLineHeight, textStyle.fontSize);

    charsInfo.forEach((charInfo, index) => {
      const { richOptions, offsetX, width } = charInfo;

      let charWidth = width;
      let offset = offsetX;

      if (overflow === spec.TextOverflow.display) {
        if (width > canvasWidth) {
          const scale = canvasWidth / width;

          charWidth *= scale;
          offset = offsetX.map(x => x * scale);
        }

      }

      const x = this.textLayout.getOffsetX(textStyle, charWidth);

      if (index > 0) {
        charsLineHeight += charInfo.lineHeight - charInfo.offsetY;
      }
      richOptions.forEach((options, index) => {
        const { fontScale, textColor, fontFamily: textFamily, textWeight, fontStyle: richStyle } = textStyle;
        const { text, fontSize, fontColor = textColor, fontFamily = textFamily, fontWeight = textWeight, fontStyle = richStyle } = options;
        let textSize = fontSize;

        if (overflow === spec.TextOverflow.display) {
          if (width > canvasWidth) {
            textSize /= width / canvasWidth;
          }
        }

        context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;

        context.fillStyle = `rgba(${fontColor[0]}, ${fontColor[1]}, ${fontColor[2]}, ${fontColor[3]})`;

        context.fillText(text, offset[index] + x, charsLineHeight);
      });
    });
    //与 toDataURL() 两种方式都需要像素读取操作
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    this.material.setTexture('_MainTex',
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
    context.restore();
  }

  setOverflow (overflow: spec.TextOverflow) {
    this.textLayout.overflow = overflow;
    this.isDirty = true;
  }

  override updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.textLayout.textBaseline = options.textBaseline || spec.TextBaseline.middle;
    this.text = options.text ? options.text.toString() : ' ';
  }

}
