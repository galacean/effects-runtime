import type { Engine } from '@galacean/effects';
import { assertExist, math, effectsClass, glContext, spec, TextComponent, Texture, TextLayout, TextStyle } from '@galacean/effects';
import { generateProgram } from './rich-text-parser';
import { toRGBA } from './color-utils';
import { RichTextStrategyFactory } from './strategies/rich-text-factory';

import type {
  RichWrapStrategy,
  RichOverflowStrategy,
  RichHorizontalAlignStrategy,
  RichVerticalAlignStrategy,
  OverflowResult,
  HorizontalAlignResult,
  VerticalAlignResult,
  RichLine,
  SizeResult,
  WrapResult,
} from './strategies/rich-text-interfaces';

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

interface CharDetail {
  /**
   * 字符内容
   */
  char: string,
  /**
   * 当前字符在本行内的起始 x 坐标（相对行起点）
   */
  x: number,
  /**
   * 当前字符的宽度
   */
  width: number,
}

interface RichCharInfo {
  /**
   * 每个富文本片段的起始 x 坐标
   */
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
  /**
   * 当前富文本片段内所有字符的详细信息
   */
  chars: CharDetail[][],
}

let seed = 0;

/**
 * RichText component class
 */
@effectsClass(spec.DataType.RichTextComponent)
export class RichTextComponent extends TextComponent {
  processedTextOptions: RichTextOptions[] = [];
  // 字体高度的倍数（字体高度上下多出来的部分就是行间距）
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

  // 富文本专用策略字段（避免与基类策略冲突）
  private richWrapStrategy: RichWrapStrategy;
  private richOverflowStrategy: RichOverflowStrategy;
  private richHorizontalAlignStrategy: RichHorizontalAlignStrategy;
  private richVerticalAlignStrategy: RichVerticalAlignStrategy;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MRichText' + seed++;

    // 延迟初始化策略，等到textLayout被赋值后再初始化
    this.richWrapStrategy = RichTextStrategyFactory.createWrapStrategy();
    this.richOverflowStrategy = RichTextStrategyFactory.createOverflowStrategy('display' as any); // 使用默认值
    this.richHorizontalAlignStrategy = RichTextStrategyFactory.createHorizontalAlignStrategy();
    this.richVerticalAlignStrategy = RichTextStrategyFactory.createVerticalAlignStrategy();
  }

  /**
   * 更新策略配置（当textLayout被赋值后调用）
   */
  private updateStrategies (): void {
    if (this.textLayout) {
      // 根据textLayout属性创建相应的策略
      this.richWrapStrategy = RichTextStrategyFactory.createWrapStrategy(this.textLayout.wrapEnabled);
      // 重新创建溢出策略以使用正确的overflow设置
      this.richOverflowStrategy = RichTextStrategyFactory.createOverflowStrategy(this.textLayout.overflow);
    }
  }

  private generateTextProgram (text: string) {
    this.processedTextOptions = [];
    const program = generateProgram((text, context) => {
      //  如果富文本仅包含换行符，则在每个换行符后添加一个空格
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

    // 根据useLegacyRichText字段来判断使用哪种渲染模式
    const useLegacy = this.textLayout.useLegacyRichText === true;

    this.singleLineHeight = useLegacy ? 1.571 : 1.0;

    if (useLegacy) {
      this.updateTextureLegacy(flipY);
    } else {
      // 使用策略管线的新Modern路径
      this.updateTextureWithStrategies(flipY);
    }
  }

  private updateTextureLegacy (flipY: boolean) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }
    // 解析富文本
    this.generateTextProgram(this.text);
    let width = 0, height = 0;
    const { textLayout, textStyle } = this;
    const { overflow, letterSpace = 0 } = textLayout;
    const context = this.context;

    context.save();

    const charsInfo: Omit<RichCharInfo, 'chars'>[] = [];
    const fontHeight = textStyle.fontSize * this.textStyle.fontScale;
    let charInfo: Omit<RichCharInfo, 'chars'> = {
      richOptions: [],
      offsetX: [],
      width: 0,
      // 包括字体和上下行间距的高度
      lineHeight: fontHeight * this.singleLineHeight,
      // 字体偏移高度（也就是行间距）
      offsetY: fontHeight * (this.singleLineHeight - 1) / 2,
    };

    // 遍历解析后的文本选项
    this.processedTextOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      // 如果是新行，则将之前行的信息存入charsInfo并且初始化新行的charInfo
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
        // 管理行的总高度调整canvas尺寸
        height += charInfo.lineHeight;
      }
      // 恢复默认设置
      context.font = `${options.fontWeight || textStyle.textWeight} 10px ${options.fontFamily || textStyle.fontFamily}`;
      // 计算得到每个字段的宽度textWidth
      const textMetrics = context.measureText(text);
      let textWidth = textMetrics.width;

      if (textMetrics.actualBoundingBoxLeft !== undefined && textMetrics.actualBoundingBoxRight !== undefined) {
        const actualWidth = textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight;

        if (actualWidth > 0) {
          textWidth = Math.max(textWidth, actualWidth);
        }
      }
      const textHeight = fontSize * this.singleLineHeight * this.textStyle.fontScale;

      if (textHeight > charInfo.lineHeight) {
        height += textHeight - charInfo.lineHeight;
        charInfo.lineHeight = textHeight;
        charInfo.offsetY = fontSize * this.textStyle.fontScale * (this.singleLineHeight - 1) / 2;
      }
      charInfo.offsetX.push(charInfo.width);
      // 计算字段宽度*富文本字体大小*缩放因子*整体文本大小+每个字符的间距（每个字符间距存疑，因为实际测量的宽度已经包含了间距）
      charInfo.width += (textWidth <= 0 ? 0 : textWidth) * fontSize * this.SCALE_FACTOR * this.textStyle.fontScale + text.length * letterSpace;

      // 将富文本数据存入charInfo
      charInfo.richOptions.push(options);
    });
    // 存储最后一行的字符信息，并且更新最终的宽度和高度用于确定canvas尺寸
    charsInfo.push(charInfo);
    width = Math.max(width, charInfo.width);
    height += charInfo.lineHeight;
    if (width === 0 || height === 0) {
      this.isDirty = false;
      context.restore();

      return;
    }

    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    // 首次渲染时初始化canvas尺寸和组件变换
    if (!this.initialized) {
      this.canvasSize = !this.canvasSize ? new math.Vector2(width, height) : this.canvasSize;
      const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

      this.item.transform.size.set(x * canvasWidth * this.SCALE_FACTOR * this.SCALE_FACTOR, y * canvasHeight * this.SCALE_FACTOR * this.SCALE_FACTOR);
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
      context.restore();

      return;
    }
    let charsLineHeight = textLayout.getOffsetY(textStyle, charsInfo.length, fontHeight * this.singleLineHeight, textStyle.fontSize);

    charsInfo.forEach((charInfo, index) => {
      const { richOptions, offsetX, width } = charInfo;
      let charWidth = width;
      let offset = offsetX;

      if (overflow === spec.TextOverflow.display) {
        if (width > canvasWidth) {
          const canvasScale = canvasWidth / width;

          charWidth *= canvasScale;
          offset = offsetX.map(x => x * canvasScale);
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

        const strOffsetX = offset[index] + x;

        context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
        context.fillStyle = `rgba(${fontColor[0]}, ${fontColor[1]}, ${fontColor[2]}, ${fontColor[3]})`;

        context.fillText(text, strOffsetX, charsLineHeight);

      });
    });
    // 与 toDataURL() 两种方式都需要像素读取操作
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    const texture = Texture.createWithData(
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
    );

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);

    this.isDirty = false;
    context.restore();
  }

  private updateTextureModern (flipY: boolean) {
    // 解析富文本
    this.generateTextProgram(this.text);
    let width = 0, height = 0;
    const { textLayout, textStyle } = this;
    const { overflow, letterSpace = 0 } = textLayout;
    const context = this.context;

    if (!context) {
      return;
    }

    context.save();

    const charsInfo: RichCharInfo[] = [];
    const fontHeight = textStyle.fontSize * this.textStyle.fontScale;
    let charInfo: RichCharInfo = {
      richOptions: [],
      offsetX: [],
      width: 0,
      // 包括字体和上下行间距的高度
      lineHeight: fontHeight * this.singleLineHeight + (this.textLayout.lineGap || 0) * this.textStyle.fontScale,
      // 字体偏移高度（也就是行间距）
      offsetY: (this.textLayout.lineGap || 0) * this.textStyle.fontScale / 2,
      chars: [],
    };

    // 遍历解析后的文本选项
    this.processedTextOptions.forEach(options => {
      const { text, isNewLine, fontSize } = options;

      // 如果是新行，则结束上一行并开始新行
      if (isNewLine) {
        // 结束上一行：累加行高并重置charInfo
        height += charInfo.lineHeight;
        charsInfo.push(charInfo);
        width = Math.max(width, charInfo.width);

        // 初始化新行
        charInfo = {
          richOptions: [],
          offsetX: [],
          width: 0,
          lineHeight: fontHeight * this.singleLineHeight + (this.textLayout.lineGap || 0) * this.textStyle.fontScale,
          offsetY: (this.textLayout.lineGap || 0) * this.textStyle.fontScale / 2,
          chars: [],
        };
      }
      // 恢复默认设置
      context.font = `${options.fontWeight || textStyle.textWeight} 10px ${options.fontFamily || textStyle.fontFamily}`;

      const textHeight = fontSize * this.singleLineHeight * this.textStyle.fontScale + (this.textLayout.lineGap || 0) * this.textStyle.fontScale;

      // 更新当前行的最大行高
      if (textHeight > charInfo.lineHeight) {
        charInfo.lineHeight = textHeight;
        charInfo.offsetY = (this.textLayout.lineGap || 0) * this.textStyle.fontScale / 2;
      }

      charInfo.offsetX.push(charInfo.width);
      // 逐字计算宽度以实现字符间距
      let segmentInnerX = 0;
      const charArr: CharDetail[] = [];

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const tempcharWidth = context.measureText(char).width;
        const charWidth = (tempcharWidth <= 0 ? 0 : tempcharWidth) * fontSize * this.SCALE_FACTOR * this.textStyle.fontScale;

        charArr.push({
          char,
          x: segmentInnerX,
          width: charWidth,
        });
        segmentInnerX += charWidth + letterSpace;
      }
      charInfo.chars.push(charArr);
      charInfo.width += segmentInnerX;
      charInfo.richOptions.push(options);
    });
    // 结束最后一行
    height += charInfo.lineHeight;
    charsInfo.push(charInfo);
    width = Math.max(width, charInfo.width);
    if (width === 0 || height === 0) {
      this.isDirty = false;
      context.restore();

      return;
    }

    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    // 首次渲染时初始化canvas尺寸和组件变换
    if (!this.initialized) {
      this.canvasSize = !this.canvasSize ? new math.Vector2(width, height) : this.canvasSize;
      const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

      this.item.transform.size.set(x * canvasWidth * this.SCALE_FACTOR * this.SCALE_FACTOR, y * canvasHeight * this.SCALE_FACTOR * this.SCALE_FACTOR);
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
      context.restore();

      return;
    }

    // 行高数组
    const lineHeights = charsInfo.map(l => l.lineHeight);

    // 计算第一行基线Y坐标
    const firstLine = charsInfo[0];
    const firstLineMaxFontSize = Math.max(...(firstLine?.richOptions?.map(opt => opt.fontSize) ?? [this.textStyle.fontSize]));
    const fontSizeForOffset = firstLineMaxFontSize * this.textStyle.fontScale * this.singleLineHeight;

    let baselineY = textLayout.getOffsetYRich(this.textStyle, lineHeights, fontSizeForOffset);

    // 逐行绘制
    charsInfo.forEach((charInfo, index) => {
      const { richOptions, offsetX, width, chars } = charInfo;
      let charWidth = width;
      let offset = offsetX;
      const charsArr = chars;

      if (overflow === spec.TextOverflow.display) {
        if (width > canvasWidth) {
          const canvasScale = canvasWidth / width;

          charWidth *= canvasScale;
          offset = offsetX.map(x => x * canvasScale);
          charsArr.forEach(charArr => {
            charArr.forEach(charDetail => {
              charDetail.x *= canvasScale;
              charDetail.width *= canvasScale;
            });
          });
        }
      }
      const x = this.textLayout.getOffsetX(textStyle, charWidth);

      richOptions.forEach((options, segIndex) => {
        const { fontScale, textColor, fontFamily: textFamily, textWeight, fontStyle: richStyle } = textStyle;
        const { fontSize, fontColor = textColor, fontFamily = textFamily, fontWeight = textWeight, fontStyle = richStyle } = options;
        let textSize = fontSize;

        if (overflow === spec.TextOverflow.display && width > canvasWidth) {
          textSize /= width / canvasWidth;
        }

        const strOffsetX = offset[segIndex] + x;

        context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
        context.fillStyle = `rgba(${fontColor[0]}, ${fontColor[1]}, ${fontColor[2]}, ${fontColor[3]})`;

        // 逐字绘制
        const charArr = charInfo.chars[segIndex];

        charArr.forEach(charDetail => {
          context.fillText(charDetail.char, strOffsetX + charDetail.x, baselineY);
        });
      });

      // 推进到下一行
      if (index < charsInfo.length - 1) {
        baselineY += lineHeights[index + 1];
      }
    });

    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const texture = Texture.createWithData(
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
    );

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
    this.isDirty = false;
    context.restore();
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 水平偏移距离
   * @returns
   */
  override setShadowOffsetY (value: number): void {
    throw new Error('Method not implemented.');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 模糊程度
   */
  override setShadowBlur (value: number): void {
    throw new Error('Method not implemented.');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 水平偏移距离
   */
  override setShadowOffsetX (value: number): void {
    throw new Error('Method not implemented.');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 阴影颜色
   */
  override setShadowColor (value: spec.RGBAColorValue): void {
    throw new Error('Method not implemented.');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 外描边宽度
   * @returns
   */
  override setOutlineWidth (value: number): void {
    throw new Error('Method not implemented.');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 是否自动设置宽度
   */
  override setAutoWidth (value: boolean): void {
    throw new Error('Method not implemented.');
  }

  override updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    // TextLayout 构造函数已经正确处理了 textBaseline，这里不需要再设置
    this.text = options.text ? options.text.toString() : ' ';

    // 更新策略配置以使用正确的textLayout设置
    this.updateStrategies();
  }

  protected override renderText (options: spec.RichTextContentOptions) {
    const { size } = options;

    if (size) {
      this.canvasSize = new math.Vector2(size[0], size[1]);
    }
    this.updateTexture();
  }

  /**
   * 使用策略管线的Modern路径渲染方法
   */
  private updateTextureWithStrategies (flipY: boolean): void {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }

    // 解析富文本
    this.generateTextProgram(this.text);
    const { textLayout, textStyle } = this;
    const { letterSpace = 0 } = textLayout;
    const context = this.context;

    if (!context) {
      return;
    }

    context.save();

    // 步骤1: 换行策略计算行信息
    const wrapResult = this.richWrapStrategy.computeLines(
      this.processedTextOptions,
      context,
      textStyle,
      textLayout,
      this.singleLineHeight,
      this.textStyle.fontScale,
      letterSpace,
      this.SCALE_FACTOR
    );

    if (wrapResult.lines.length === 0 || wrapResult.maxLineWidth === 0 || wrapResult.totalHeight === 0) {
      this.isDirty = false;
      context.restore();

      return;
    }

    // 步骤2: 尺寸处理
    const sizeResult = this.resolveCanvasSize(
      wrapResult,
      textLayout,
      textStyle,
      this.singleLineHeight
    );

    // 首次渲染时初始化canvas尺寸和组件变换
    this.setCanvasSize(sizeResult);

    // 步骤3: 溢出策略处理
    const overflowResult = this.richOverflowStrategy.apply(
      wrapResult.lines,
      sizeResult,
      textLayout,
      textStyle
    );

    // 步骤4: 水平对齐策略
    const horizontalAlignResult = this.richHorizontalAlignStrategy.getHorizontalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      textLayout,
      textStyle
    );

    // 步骤5: 垂直对齐策略
    const verticalAlignResult = this.richVerticalAlignStrategy.getVerticalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      textLayout,
      textStyle,
      this.singleLineHeight
    );

    // 使用this.canvasSize统一设置画布尺寸
    assertExist(this.canvasSize);
    const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

    this.textLayout.width = canvasWidth / textStyle.fontScale;
    this.textLayout.height = canvasHeight / textStyle.fontScale;
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // 调试排版
    context.fillStyle = 'rgba(255,0,0,255)';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // fix bug 1/255
    context.fillStyle = `rgba(255, 255, 255, ${this.ALPHA_FIX_VALUE})`;
    if (!flipY) {
      context.translate(0, canvasHeight);
      context.scale(1, -1);
    }

    // 步骤6: 绘制文本
    this.drawTextWithStrategies(
      context,
      wrapResult.lines,
      horizontalAlignResult,
      verticalAlignResult,
      overflowResult,
      textStyle
    );

    // 创建纹理
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const texture = Texture.createWithData(
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
    );

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
    this.isDirty = false;
    context.restore();
  }

  private setCanvasSize (sizeResult: SizeResult): void {
    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    switch (this.textLayout.overflow) {
      case spec.TextOverflow.visible:
      case spec.TextOverflow.clip: {
        const frameW = this.textLayout.maxTextWidth;
        const frameH = this.textLayout.maxTextHeight;

        const bboxTop = sizeResult.bboxTop ?? 0;
        const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
        const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

        // 计算 frame 基线
        let baselineYFrame = 0;

        switch (this.textLayout.textBaseline) {
          case spec.TextBaseline.top:
            baselineYFrame = -bboxTop;

            break;
          case spec.TextBaseline.middle:
            baselineYFrame = (frameH - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextBaseline.bottom:
            baselineYFrame = (frameH - bboxHeight) - bboxTop;

            break;
        }

        // 上下溢出检测
        const contentTopInFrame = baselineYFrame + bboxTop;
        const contentBottomInFrame = baselineYFrame + bboxBottom;

        const overflowTop = Math.max(0, -contentTopInFrame);
        const overflowBottom = Math.max(0, contentBottomInFrame - frameH);

        // 垂直扩张
        let expandTop = overflowTop;
        let expandBottom = overflowBottom;

        switch (this.textLayout.textBaseline) {
          case spec.TextBaseline.top: {
            const E = overflowBottom;

            expandTop = E;
            expandBottom = E;

            break;
          }
          case spec.TextBaseline.bottom: {
            const E = overflowTop;

            expandTop = E;
            expandBottom = E;

            break;
          }
          case spec.TextBaseline.middle: {
            // 保持非对称：上扩 overflowTop，下扩 overflowBottom
            expandTop = overflowTop;
            expandBottom = overflowBottom;

            break;
          }
        }

        // 位移补偿：始终使用 expandTop
        const compY = expandTop;

        // 水平扩张（保持你的原逻辑，或按需禁用）
        const lines = sizeResult.lines || [];
        const xOffsetsFrame = lines.map(line =>
          this.textLayout.getOffsetXRich(this.textStyle, frameW, line.width)
        );
        const leftMost = xOffsetsFrame.length > 0 ? Math.min(...xOffsetsFrame) : 0;
        const ex = Math.max(0, -leftMost);
        const expandLeft = ex;
        const expandRight = ex;

        const finalW = frameW + expandLeft + expandRight;
        const finalH = frameH + expandTop + expandBottom;

        // 记录补偿，供垂直对齐策略叠加
        (sizeResult as any).baselineCompensationX = expandLeft;
        (sizeResult as any).baselineCompensationY = compY;

        sizeResult.canvasWidth = finalW;
        sizeResult.canvasHeight = finalH;

        this.canvasSize = new math.Vector2(finalW, finalH);
        const { x = 1, y = 1 } = this.size ?? this.item.transform.size;

        this.item.transform.size.set(
          x * finalW * this.SCALE_FACTOR * this.SCALE_FACTOR,
          y * finalH * this.SCALE_FACTOR * this.SCALE_FACTOR
        );
        this.size = this.item.transform.size.clone();
        this.initialized = true;

        break;
      }
      case spec.TextOverflow.display: {
        if (!this.initialized) {
          this.canvasSize = new math.Vector2(this.textLayout.maxTextWidth, this.textLayout.maxTextHeight);
          this.item.transform.size.set(
            x * this.canvasSize.x * this.SCALE_FACTOR * this.SCALE_FACTOR,
            y * this.canvasSize.y * this.SCALE_FACTOR * this.SCALE_FACTOR
          );
          this.size = this.item.transform.size.clone();
          this.initialized = true;
        }

        break;
      }
    }
  }

  /**
   * 尺寸处理
   */
  private resolveCanvasSize (
    wrapResult: WrapResult,
    layout: TextLayout,
    style: TextStyle,
    singleLineHeight: number
  ): SizeResult {
    const canvasWidth = Math.max(1, wrapResult.maxLineWidth || 0);
    const canvasHeight = Math.max(1, wrapResult.totalHeight || 0); // stepTotalHeight

    layout.width = canvasWidth / style.fontScale;
    layout.height = canvasHeight / style.fontScale;

    // 计算自然基线 baselineYPre
    const lineHeights = wrapResult.lines.map(l => l.lineHeight);
    const firstLine = wrapResult.lines[0];
    const firstLineMaxFontSize = Math.max(...(firstLine?.richOptions?.map(o => o.fontSize) ?? [style.fontSize]));
    const fontSizeForOffset = firstLineMaxFontSize * style.fontScale * singleLineHeight;
    const baselineYPre = layout.getOffsetYRich(style, lineHeights, fontSizeForOffset);

    return {
      canvasWidth,
      canvasHeight,
      transformScale: { x: 1, y: 1 },
      // 透传
      naturalHeight: wrapResult.totalHeight,
      contentWidth: wrapResult.maxLineWidth,
      gapPx: wrapResult.gapPx,
      baselines: wrapResult.baselines,
      bboxTop: wrapResult.bboxTop,
      bboxBottom: wrapResult.bboxBottom,
      bboxHeight: wrapResult.bboxHeight,
      firstVisibleHeight: wrapResult.firstVisibleHeight,
      baselineYPre, // 新增
      // 为visible模式的画布尺寸计算保留行信息
      lines: wrapResult.lines,
    } as SizeResult;
  }

  /**
   * 使用策略结果绘制文本
   */
  private drawTextWithStrategies (
    context: CanvasRenderingContext2D,
    lines: RichLine[],
    horizontalAlignResult: HorizontalAlignResult,
    verticalAlignResult: VerticalAlignResult,
    overflowResult: OverflowResult,
    textStyle: TextStyle
  ): void {
    let currentBaselineY = verticalAlignResult.baselineY;
    const { lineOffsets } = horizontalAlignResult;

    lines.forEach((line, index) => {
      const { richOptions, chars } = line;
      const xOffset = lineOffsets[index];
      const yOffset = currentBaselineY;

      richOptions.forEach((options, segIndex) => {
        const { fontScale, textColor, fontFamily: textFamily, textWeight, fontStyle: richStyle } = textStyle;
        const { fontSize, fontColor = textColor, fontFamily = textFamily, fontWeight = textWeight, fontStyle = richStyle } = options;

        // 直接使用原始字体大小（已在行数据中预缩放）
        const textSize = fontSize;

        context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
        context.fillStyle = `rgba(${fontColor[0]}, ${fontColor[1]}, ${fontColor[2]}, ${fontColor[3]})`;

        // 逐字绘制
        const segStartX = (line.offsetX && line.offsetX[segIndex]) ? line.offsetX[segIndex] : 0;
        const charArr = chars[segIndex];

        charArr.forEach(charDetail => {
          // 直接使用缩放后的字符位置
          context.fillText(charDetail.char, xOffset + segStartX + charDetail.x, yOffset);
        });
      });

      // 推进到下一行
      if (index < lines.length - 1) {
        currentBaselineY += lines[index + 1].lineHeight;
      }
    });
  }

}
