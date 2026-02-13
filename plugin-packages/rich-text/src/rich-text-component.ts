/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine, IRichTextComponent } from '@galacean/effects';
import {
  assertExist, math, effectsClass, spec, MaskableGraphic, applyMixins, TextStyle,
  TextComponentBase,
} from '@galacean/effects';
import { RichTextLayout } from './rich-text-layout';
import { generateProgram } from './rich-text-parser';
import { toRGBA } from './color-utils';
import { RichTextStrategyFactory } from './strategies/rich-text-factory';
import type {
  RichWrapStrategy, RichOverflowStrategy, RichHorizontalAlignStrategy, RichLine,
  RichVerticalAlignStrategy, OverflowResult,
  HorizontalAlignResult, VerticalAlignResult,
} from './strategies/rich-text-interfaces';
import { scaleLinesToFit } from './strategies/rich-text-interfaces';

export interface RichTextOptions {
  text: string,
  fontSize: number,
  fontFamily?: string,
  fontWeight?: spec.TextWeight,
  fontStyle?: spec.FontStyle,
  fontColor?: spec.vec4,
  isNewLine: boolean,
}

interface CharDetail {
  char: string,
  x: number,
  width: number,
}

interface RichCharInfo {
  offsetX: number[],
  richOptions: RichTextOptions[],
  width: number,
  lineHeight: number,
  offsetY: number,
  chars: CharDetail[][],
}

export interface RichTextComponent extends TextComponentBase { }

let seed = 0;

/**
 * 富文本组件类
 */
@effectsClass(spec.DataType.RichTextComponent)
export class RichTextComponent extends MaskableGraphic implements IRichTextComponent {
  isDirty = true;
  text: string = '';
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: RichTextLayout;

  processedTextOptions: RichTextOptions[] = [];
  private singleLineHeight: number = 1.571;
  /** @deprecated Use for legacy mode*/
  private size: math.Vector2 | null = null;
  /** @deprecated Use for legacy mode*/
  private initialized: boolean = false;
  private canvasSize: math.Vector2 | null = null;

  private richWrapStrategy: RichWrapStrategy;
  private richOverflowStrategy: RichOverflowStrategy;
  private richHorizontalAlignStrategy: RichHorizontalAlignStrategy;
  private richVerticalAlignStrategy: RichVerticalAlignStrategy;

  protected readonly SCALE_FACTOR = 0.11092565;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MRichText' + seed++;

    this.initTextBase(engine);

    // 延迟初始化策略，等到textLayout被赋值后再初始化
    this.richWrapStrategy = RichTextStrategyFactory.createWrapStrategy();
    this.richOverflowStrategy = RichTextStrategyFactory.createOverflowStrategy(spec.TextOverflow.display);
    this.richHorizontalAlignStrategy = RichTextStrategyFactory.createHorizontalAlignStrategy();
    this.richVerticalAlignStrategy = RichTextStrategyFactory.createVerticalAlignStrategy();
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    this.updateTexture();
  }

  override onDestroy (): void {
    super.onDestroy();
    this.disposeTextTexture();
  }

  override fromData (data: spec.RichTextComponentData): void {
    super.fromData(data);
    const { interaction, options } = data;

    this.interaction = interaction;

    this.textStyle = new TextStyle(options);
    this.textLayout = new RichTextLayout(options);
    this.text = options.text ? options.text.toString() : ' ';

    if (this.textLayout.useLegacyRichText) {
      this.textLayout.textVerticalAlign = spec.TextVerticalAlign.middle;
    }

    this.updateStrategies();
    this.updateTexture();

    // 设置默认颜色（math.Color）
    this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
  }

  /**
   * 根据布局配置更新策略实例
   */
  private updateStrategies (): void {
    const layout = this.textLayout;

    if (layout) {
      this.richWrapStrategy = RichTextStrategyFactory.createWrapStrategy(layout.wrapEnabled);
      this.richOverflowStrategy = RichTextStrategyFactory.createOverflowStrategy(layout.overflow);
    }
  }

  private generateTextProgram (text: string) {
    this.processedTextOptions = [];
    const program = generateProgram((text, context) => {
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
  /**
   * 根据配置更新文本样式和布局
   */
  protected updateWithOptions (options: spec.RichTextContentOptions): void {
    this.textStyle = new TextStyle(options);
    this.textLayout = new RichTextLayout(options);
    this.text = options.text ? options.text.toString() : ' ';
    // TextLayout 构造函数已经正确处理了 textVerticalAlign，这里不需要再设置
    if (this.textLayout.useLegacyRichText) {
      this.textLayout.textVerticalAlign = spec.TextVerticalAlign.middle;
    }
    this.updateStrategies();
    this.isDirty = true;
  }

  /**
   * 更新文本
   * @returns
   */
  protected updateTexture (flipY = true): void {
    if (!this.isDirty || !this.context || !this.canvas || !this.textStyle || !this.textLayout) {
      return;
    }

    const layout = this.textLayout;
    const useLegacy = layout.useLegacyRichText === true;

    this.singleLineHeight = useLegacy ? 1.571 : 1.0;

    // 根据useLegacyRichText字段来判断使用哪种渲染模式
    if (useLegacy) {
      this.updateTextureLegacy(flipY);
    } else {
      this.updateTextureWithStrategies(flipY);
    }
  }

  /**
   * 解析富文本
   */
  private updateTextureLegacy (flipY: boolean) {
    if (!this.isDirty || !this.context || !this.canvas || !this.textStyle) {
      return;
    }

    const legacyScaleFactor = 0.1;

    this.generateTextProgram(this.text);
    let width = 0, height = 0;
    const layout = this.textLayout;
    const { textStyle } = this;
    const { overflow, letterSpace = 0 } = layout;
    const context = this.context;

    const charsInfo: Omit<RichCharInfo, 'chars'>[] = [];
    const fontHeight = textStyle.fontSize * textStyle.fontScale;
    let charInfo: Omit<RichCharInfo, 'chars'> = {
      richOptions: [],
      offsetX: [],
      width: 0,
      lineHeight: fontHeight * this.singleLineHeight,
      offsetY: fontHeight * (this.singleLineHeight - 1) / 2,
    };

    // 遍历解析后的文本选项
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

      context.font = `${options.fontWeight || textStyle.textWeight} 10px ${options.fontFamily || textStyle.fontFamily}`;
      const textMetrics = context.measureText(text);
      let textWidth = textMetrics.width;

      if (textMetrics.actualBoundingBoxLeft !== undefined && textMetrics.actualBoundingBoxRight !== undefined) {
        const actualWidth = textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight;

        if (actualWidth > 0) {
          textWidth = Math.max(textWidth, actualWidth);
        }
      }

      const textHeight = fontSize * this.singleLineHeight * textStyle.fontScale;

      if (textHeight > charInfo.lineHeight) {
        height += textHeight - charInfo.lineHeight;
        charInfo.lineHeight = textHeight;
        charInfo.offsetY = fontSize * textStyle.fontScale * (this.singleLineHeight - 1) / 2;
      }

      charInfo.offsetX.push(charInfo.width);
      charInfo.width += (textWidth <= 0 ? 0 : textWidth) * fontSize * legacyScaleFactor * textStyle.fontScale + text.length * letterSpace;
      charInfo.richOptions.push(options);
    });

    charsInfo.push(charInfo);
    width = Math.max(width, charInfo.width);
    height += charInfo.lineHeight;

    // 存储最后一行的字符信息，并且更新最终的宽度和高度用于确定canvas尺寸
    if (width === 0 || height === 0) {
      this.isDirty = false;

      return;
    }

    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    if (!this.initialized) {
      this.canvasSize = !this.canvasSize ? new math.Vector2(width, height) : this.canvasSize;
      const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

      this.item.transform.size.set(
        x * canvasWidth * legacyScaleFactor * legacyScaleFactor,
        y * canvasHeight * legacyScaleFactor * legacyScaleFactor
      );
      this.size = this.item.transform.size.clone();
      this.initialized = true;
    }

    assertExist(this.canvasSize);
    const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

    layout.width = canvasWidth / textStyle.fontScale;
    layout.height = canvasHeight / textStyle.fontScale;

    this.renderToTexture(canvasWidth, canvasHeight, flipY, context => {
      if (charsInfo.length === 0) {
        return;
      }

      let charsLineHeight = layout.getOffsetY(textStyle, charsInfo.length, fontHeight * this.singleLineHeight, textStyle.fontSize);

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

        const x = layout.getOffsetX(textStyle, charWidth);

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

          // fix bug 1/255
          context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
          const [r, g, b, a] = fontColor;

          context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;

          context.fillText(text, strOffsetX, charsLineHeight);
        });
      });
    }, { disposeOld: false });

    // 与 toDataURL() 两种方式都需要像素读取操作
    this.isDirty = false;
  }

  /**
   * 使用策略管线路径的渲染方法
   *
   * 管线顺序：
   * 1. Wrap        → 换行与度量
   * 2. SizeMode    → 根据 autoResize 回写帧尺寸
   * 3. ContentScale → 内容缩放（仅 display 模式）
   * 4. Alignment   → 在帧坐标系中对齐（不依赖 overflow）
   * 5. Overflow    → 画布解析：确定最终画布尺寸与渲染偏移（不依赖对齐模式）
   * 6. Render      → 绘制
   */
  private updateTextureWithStrategies (flipY: boolean): void {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }

    // 解析富文本
    this.generateTextProgram(this.text);
    const layout = this.textLayout;
    const { letterSpace = 0 } = layout;
    const context = this.context;

    if (!context) {
      return;
    }

    const fontScale = this.textStyle.fontScale;

    // autoWidth 模式下先去掉宽度约束，避免内容被提前换行
    if (layout.autoResize === spec.TextSizeMode.autoWidth) {
      layout.maxTextWidth = Number.MAX_SAFE_INTEGER;
    }

    // ── 步骤 1: 换行策略 ──
    const wrapResult = this.richWrapStrategy.computeLines(
      this.processedTextOptions,
      context,
      this.textStyle,
      layout,
      this.singleLineHeight,
      fontScale,
      letterSpace,
    );

    // ── 步骤 2: SizeMode 回写帧尺寸 ──
    switch (layout.autoResize) {
      case spec.TextSizeMode.autoWidth:
        layout.maxTextWidth = Math.max(1, (wrapResult.maxLineWidth || 0) / fontScale);
        layout.maxTextHeight = Math.max(1, (wrapResult.totalHeight || 0) / fontScale);

        break;
      case spec.TextSizeMode.autoHeight:
        layout.maxTextHeight = Math.max(1, (wrapResult.totalHeight || 0) / fontScale);

        break;
      case spec.TextSizeMode.fixed:
        break;
    }

    // 帧尺寸（像素）
    const frameW = layout.maxTextWidth * fontScale;
    const frameH = layout.maxTextHeight * fontScale;

    // ── 步骤 3: 内容缩放（display 模式缩小以适配帧，其他模式跳过）──
    if (layout.overflow === spec.TextOverflow.display) {
      const contentW = Math.max(1, wrapResult.maxLineWidth || 0);
      const contentH = Math.max(1, wrapResult.totalHeight || 0);

      scaleLinesToFit(wrapResult.lines, contentW, contentH, frameW, frameH);
    }

    // ── 步骤 4: 对齐（在帧坐标系中，不依赖 overflow 模式）──
    const horizontalAlignResult = this.richHorizontalAlignStrategy.getHorizontalOffsets(
      wrapResult.lines,
      frameW,
      layout,
      this.textStyle,
    );

    const verticalAlignResult = this.richVerticalAlignStrategy.getVerticalOffsets(
      wrapResult.lines,
      frameH,
      layout,
      this.textStyle,
      this.singleLineHeight,
    );

    // ── 步骤 5: 溢出 / 画布解析（不依赖对齐模式枚举）──
    const overflowResult = this.richOverflowStrategy.resolveCanvas(
      wrapResult.lines,
      frameW,
      frameH,
      horizontalAlignResult,
      verticalAlignResult,
    );

    this.canvasSize = new math.Vector2(overflowResult.canvasWidth, overflowResult.canvasHeight);

    // 实际元素渲染尺寸不随着 fontScale 改变
    this.item.transform.size.set(
      this.canvasSize.x / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR,
      this.canvasSize.y / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR
    );

    // 画布尺寸确保至少为 1
    const safeW = Math.max(1, Math.ceil(this.canvasSize.x));
    const safeH = Math.max(1, Math.ceil(this.canvasSize.y));

    layout.width = safeW / fontScale;
    layout.height = safeH / fontScale;

    this.renderToTexture(safeW, safeH, flipY, context => {
      // ── 步骤 6: 绘制 ──
      this.drawTextWithStrategies(
        context,
        wrapResult.lines,
        horizontalAlignResult,
        verticalAlignResult,
        overflowResult,
        this.textStyle,
      );
    }, { disposeOld: false });

    this.isDirty = false;
  }

  /**
   * 使用策略结果绘制文本
   * 坐标 = 帧坐标（对齐结果） + 渲染偏移（溢出结果）
   */
  private drawTextWithStrategies (
    context: CanvasRenderingContext2D,
    lines: RichLine[],
    horizontalAlignResult: HorizontalAlignResult,
    verticalAlignResult: VerticalAlignResult,
    overflowResult: OverflowResult,
    textStyle: TextStyle
  ): void {
    const { renderOffsetX, renderOffsetY } = overflowResult;
    let currentBaselineY = verticalAlignResult.baselineY + renderOffsetY;
    const { lineOffsets } = horizontalAlignResult;

    lines.forEach((line, index) => {
      const { richOptions, chars } = line;
      const xOffset = lineOffsets[index] + renderOffsetX;
      const yOffset = currentBaselineY;

      richOptions.forEach((options, segIndex) => {
        const { fontScale, textColor, fontFamily: textFamily, textWeight, fontStyle: richStyle } = textStyle;
        const { fontSize, fontColor = textColor, fontFamily = textFamily, fontWeight = textWeight, fontStyle = richStyle } = options;

        const textSize = fontSize;

        context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
        const [r, g, b, a] = fontColor;

        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;

        const segStartX = (line.offsetX && line.offsetX[segIndex]) ? line.offsetX[segIndex] : 0;
        const charArr = chars[segIndex];

        charArr.forEach(charDetail => {
          context.fillText(charDetail.char, xOffset + segStartX + charDetail.x, yOffset);
        });
      });

      // 推进到下一行
      if (index < lines.length - 1) {
        currentBaselineY += lines[index + 1].lineHeight;
      }
    });
  }

  private unsupported (name: string): never {
    throw new Error(`RichTextComponent does not support ${name} at runtime.`);
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetY (value: number): void {
    this.unsupported('setShadowOffsetY');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 模糊程度
   */
  setShadowBlur (value: number): void {
    this.unsupported('setShadowBlur');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 水平偏移距离
   */
  setShadowOffsetX (value: number): void {
    this.unsupported('setShadowOffsetX');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 阴影颜色
   */
  setShadowColor (value: spec.RGBAColorValue): void {
    this.unsupported('setShadowColor');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 外描边宽度
   * @returns
   */
  setOutlineWidth (value: number): void {
    this.unsupported('setOutlineWidth');
  }

  /**
   * 该方法富文本组件不支持
   * @param value - 是否自动设置宽度
   */
  setAutoWidth (value: boolean): void {
    this.unsupported('setAutoWidth');
  }

  /**
   * 该方法富文本组件不支持
   */
  setFontSize (value: number): void {
    this.unsupported('setFontSize');
  }

  /**
   * @deprecated 2.8.0 本方法已废弃，请使用 setTextVerticalAlign 替代。
   */
  setTextBaseline (value: spec.TextBaseline): void {
    console.warn(
      'setTextBaseline 已废弃，请改用 setTextVerticalAlign。' +
      '本次调用将转调用 setTextVerticalAlign。'
    );

    this.setTextVerticalAlign(value as unknown as spec.TextVerticalAlign);
  }
}

applyMixins(RichTextComponent, [TextComponentBase]);
