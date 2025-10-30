import type { Engine } from '@galacean/effects';
import {
  assertExist,
  math,
  effectsClass,
  spec,
  MaskableGraphic,
  applyMixins,
  TextStyle,
} from '@galacean/effects';
import { TextComponentBase, type RichTextRuntimeAPI } from '@galacean/effects';
import { RichTextLayout } from './rich-text-layout';
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface RichTextComponent extends TextComponentBase { }

let seed = 0;

@effectsClass(spec.DataType.RichTextComponent)
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RichTextComponent extends MaskableGraphic implements RichTextRuntimeAPI {
  isDirty = true;
  text: string = '';
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: RichTextLayout;

  processedTextOptions: RichTextOptions[] = [];
  private singleLineHeight: number = 1.571;
  private size: math.Vector2 | null = null;
  private initialized: boolean = false;
  private canvasSize: math.Vector2 | null = null;

  private richWrapStrategy: RichWrapStrategy;
  private richOverflowStrategy: RichOverflowStrategy;
  private richHorizontalAlignStrategy: RichHorizontalAlignStrategy;
  private richVerticalAlignStrategy: RichVerticalAlignStrategy;

  protected readonly SCALE_FACTOR = 0.1;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  constructor (engine: Engine) {
    super(engine);
    this.name = 'MRichText' + seed++;

    this.initTextBase(engine);

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
      this.textLayout.textBaseline = spec.TextBaseline.middle;
    }

    this.updateStrategies();
    this.renderText(options);

    // ✅ 使用 math.Color
    this.material.setColor('_Color', new math.Color(1, 1, 1, 1));
  }

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

  updateWithOptions (options: spec.RichTextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new RichTextLayout(options);
    this.text = options.text ? options.text.toString() : ' ';
    if (this.textLayout.useLegacyRichText) {
      this.textLayout.textBaseline = spec.TextBaseline.middle;
    }
    this.updateStrategies();
    this.isDirty = true;
  }

  protected renderText (options: spec.RichTextContentOptions) {
    const { size } = options;

    if (size) {
      this.canvasSize = new math.Vector2(size[0], size[1]);
    }
    this.updateTexture();
  }

  updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas || !this.textStyle || !this.textLayout) {
      return;
    }

    const layout = this.textLayout;
    const useLegacy = layout.useLegacyRichText === true;

    this.singleLineHeight = useLegacy ? 1.571 : 1.0;

    if (useLegacy) {
      this.updateTextureLegacy(flipY);
    } else {
      this.updateTextureWithStrategies(flipY);
    }
  }

  private updateTextureLegacy (flipY: boolean) {
    if (!this.isDirty || !this.context || !this.canvas || !this.textStyle) {
      return;
    }

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
      charInfo.width += (textWidth <= 0 ? 0 : textWidth) * fontSize * this.SCALE_FACTOR * textStyle.fontScale + text.length * letterSpace;
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
      this.canvasSize = !this.canvasSize ? new math.Vector2(width, height) : this.canvasSize;
      const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

      this.item.transform.size.set(
        x * canvasWidth * this.SCALE_FACTOR * this.SCALE_FACTOR,
        y * canvasHeight * this.SCALE_FACTOR * this.SCALE_FACTOR
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

          context.font = `${fontStyle} ${fontWeight} ${textSize * fontScale}px ${fontFamily}`;
          const [r, g, b, a] = fontColor;

          context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;

          context.fillText(text, strOffsetX, charsLineHeight);
        });
      });
    }, { disposeOld: false });

    this.isDirty = false;
  }

  /**
   * 使用策略管线路径的渲染方法
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

    // 步骤1: 换行策略计算行信息
    const wrapResult = this.richWrapStrategy.computeLines(
      this.processedTextOptions,
      context,
      this.textStyle,
      layout,
      this.singleLineHeight,
      this.textStyle.fontScale,
      letterSpace,
      this.SCALE_FACTOR
    );

    if (wrapResult.lines.length === 0 || wrapResult.maxLineWidth === 0 || wrapResult.totalHeight === 0) {
      this.isDirty = false;

      return;
    }

    // 步骤2: 尺寸处理
    const sizeResult = this.resolveCanvasSize(
      wrapResult,
      layout,
      this.textStyle,
      this.singleLineHeight
    );

    // 首次渲染时初始化canvas尺寸和组件变换
    this.setCanvasSize(sizeResult);

    // 步骤3: 溢出策略处理
    const overflowResult = this.richOverflowStrategy.apply(
      wrapResult.lines,
      sizeResult,
      layout,
      this.textStyle
    );

    // 步骤4: 水平对齐策略
    const horizontalAlignResult = this.richHorizontalAlignStrategy.getHorizontalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      layout,
      this.textStyle
    );

    // 步骤5: 垂直对齐策略
    const verticalAlignResult = this.richVerticalAlignStrategy.getVerticalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      layout,
      this.textStyle,
      this.singleLineHeight
    );

    // 使用this.canvasSize统一设置画布尺寸
    assertExist(this.canvasSize);
    const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

    layout.width = canvasWidth / this.textStyle.fontScale;
    layout.height = canvasHeight / this.textStyle.fontScale;

    this.renderToTexture(canvasWidth, canvasHeight, flipY, context => {
      // 步骤6: 绘制文本
      this.drawTextWithStrategies(
        context,
        wrapResult.lines,
        horizontalAlignResult,
        verticalAlignResult,
        overflowResult,
        this.textStyle
      );
    }, { disposeOld: false });

    this.isDirty = false;
  }

  private setCanvasSize (sizeResult: SizeResult): void {
    if (this.size === undefined || this.size === null) {
      this.size = this.item.transform.size.clone();
    }
    const { x = 1, y = 1 } = this.size;

    const layout = this.textLayout;

    switch (layout.overflow) {
      case spec.TextOverflow.visible: {
        const frameW = layout.maxTextWidth;
        const frameH = layout.maxTextHeight;

        const bboxTop = sizeResult.bboxTop ?? 0;
        const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
        const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

        // 计算 frame 基线
        let baselineYFrame = 0;

        switch (layout.textBaseline) {
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

        switch (layout.textBaseline) {
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

        // 水平扩张
        const lines = sizeResult.lines || [];
        const xOffsetsFrame = lines.map(line =>
          layout.getOffsetXRich(this.textStyle, frameW, line.width)
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
      case spec.TextOverflow.clip: {
        const frameW = layout.maxTextWidth;
        const frameH = layout.maxTextHeight;

        // 直接使用 frame 尺寸作为画布尺寸
        sizeResult.canvasWidth = frameW;
        sizeResult.canvasHeight = frameH;

        // clip 模式不需要任何补偿
        (sizeResult as any).baselineCompensationX = 0;
        (sizeResult as any).baselineCompensationY = 0;

        // 设置 canvas 和节点变换
        this.canvasSize = new math.Vector2(frameW, frameH);

        // 把 layout 的尺寸更新为 frame 尺寸
        layout.width = frameW / this.textStyle.fontScale;
        layout.height = frameH / this.textStyle.fontScale;

        const { x = 1, y = 1 } = this.size ?? this.item.transform.size;

        this.item.transform.size.set(
          x * frameW * this.SCALE_FACTOR * this.SCALE_FACTOR,
          y * frameH * this.SCALE_FACTOR * this.SCALE_FACTOR
        );
        this.size = this.item.transform.size.clone();
        this.initialized = true;

        break;
      }
      case spec.TextOverflow.display: {
        if (!this.initialized) {
          this.canvasSize = new math.Vector2(layout.maxTextWidth, layout.maxTextHeight);
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
    layout: RichTextLayout,
    style: TextStyle,
    singleLineHeight: number
  ): SizeResult {
    const canvasWidth = Math.max(1, wrapResult.maxLineWidth || 0);
    const canvasHeight = Math.max(1, wrapResult.totalHeight || 0); // stepTotalHeight

    layout.width = canvasWidth / style.fontScale;
    layout.height = canvasHeight / style.fontScale;

    return {
      canvasWidth,
      canvasHeight,
      contentWidth: wrapResult.maxLineWidth,
      bboxTop: wrapResult.bboxTop,
      bboxBottom: wrapResult.bboxBottom,
      bboxHeight: wrapResult.bboxHeight,
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
        const [r, g, b, a] = fontColor;

        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;

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

  private unsupported (name: string): never {
    throw new Error(`RichTextComponent does not support ${name} at runtime.`);
  }

  setShadowOffsetY (value: number): void {
    this.unsupported('setShadowOffsetY');
  }

  setShadowBlur (value: number): void {
    this.unsupported('setShadowBlur');
  }

  setShadowOffsetX (value: number): void {
    this.unsupported('setShadowOffsetX');
  }

  setShadowColor (value: spec.RGBAColorValue): void {
    this.unsupported('setShadowColor');
  }

  setOutlineWidth (value: number): void {
    this.unsupported('setOutlineWidth');
  }

  setAutoWidth (value: boolean): void {
    this.unsupported('setAutoWidth');
  }

  setFontSize (value: number): void {
    this.unsupported('setFontSize');
  }
}

applyMixins(RichTextComponent, [TextComponentBase]);
