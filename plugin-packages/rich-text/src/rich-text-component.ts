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
  RichVerticalAlignStrategy, OverflowResult, HorizontalAlignResult, VerticalAlignResult,
  SizeResult, WrapResult,
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
   * 使用策略结果绘制文本
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

    // autoWidth 模式下先去掉宽度约束，避免内容被提前换行
    if (layout.autoResize === spec.TextSizeMode.autoWidth) {
      layout.maxTextWidth = Number.MAX_SAFE_INTEGER;
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
    );

    // 根据 sizeMode 和实际内容尺寸回写 maxTextWidth / maxTextHeight
    const fontScale = this.textStyle.fontScale;

    switch (layout.autoResize) {
      case spec.TextSizeMode.autoWidth:
        // 宽高均自适应内容
        layout.maxTextWidth = Math.max(1, (wrapResult.maxLineWidth || 0) / fontScale);
        layout.maxTextHeight = Math.max(1, (wrapResult.totalHeight || 0) / fontScale);

        break;
      case spec.TextSizeMode.autoHeight:
        // 仅高度自适应内容
        layout.maxTextHeight = Math.max(1, (wrapResult.totalHeight || 0) / fontScale);

        break;
      case spec.TextSizeMode.fixed:
        // 固定宽高，保持原值
        break;
    }

    // 步骤2: 尺寸处理
    const sizeResult = this.resolveCanvasSize(
      wrapResult,
      layout,
      this.textStyle,
      this.singleLineHeight,
    );

    // 首次渲染时初始化 canvas 尺寸和组件变换
    this.setCanvasSize(sizeResult);

    // 步骤3: 溢出策略处理
    const overflowResult = this.richOverflowStrategy.apply(
      wrapResult.lines,
      sizeResult,
      layout,
      this.textStyle,
    );

    // 步骤4: 水平对齐策略
    const horizontalAlignResult = this.richHorizontalAlignStrategy.getHorizontalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      layout,
      this.textStyle,
    );

    // 步骤5: 垂直对齐策略
    const TextVerticalAlignResult = this.richVerticalAlignStrategy.getVerticalOffsets(
      wrapResult.lines,
      sizeResult,
      overflowResult,
      layout,
      this.textStyle,
      this.singleLineHeight,
    );

    // 使用 this.canvasSize 统一设置画布尺寸
    assertExist(this.canvasSize);
    const { x: canvasWidth, y: canvasHeight } = this.canvasSize;

    // 确保canvas宽高至少为1
    const safeW = Math.max(1, Math.ceil(canvasWidth));
    const safeH = Math.max(1, Math.ceil(canvasHeight));

    layout.width = safeW / this.textStyle.fontScale;
    layout.height = safeH / this.textStyle.fontScale;

    this.renderToTexture(safeW, safeH, flipY, context => {
      // 步骤6: 绘制文本
      this.drawTextWithStrategies(
        context,
        wrapResult.lines,
        horizontalAlignResult,
        TextVerticalAlignResult,
        overflowResult,
        this.textStyle,
      );
    }, { disposeOld: false });

    this.isDirty = false;
  }

  private setCanvasSize (sizeResult: SizeResult): void {
    const layout = this.textLayout;
    const fontScale = this.textStyle.fontScale || 1;

    // 防止 frameW / frameH 为 0
    const frameW = Math.max(1, layout.maxTextWidth || 0);
    const frameH = Math.max(1, layout.maxTextHeight || 0);

    switch (layout.overflow) {
      case spec.TextOverflow.visible: {
        const frameWpx = frameW * fontScale;
        const frameHpx = frameH * fontScale;

        const bboxTop = sizeResult.bboxTop ?? 0;
        const bboxBottom = sizeResult.bboxBottom ?? (bboxTop + (sizeResult.bboxHeight ?? 0));
        const bboxHeight = sizeResult.bboxHeight ?? (bboxBottom - bboxTop);

        // 计算 frame 基线
        let baselineYFrame = 0;

        switch (layout.textVerticalAlign) {
          case spec.TextVerticalAlign.top:
            baselineYFrame = -bboxTop;

            break;
          case spec.TextVerticalAlign.middle:
            baselineYFrame = (frameHpx - bboxHeight) / 2 - bboxTop;

            break;
          case spec.TextVerticalAlign.bottom:
            baselineYFrame = (frameHpx - bboxHeight) - bboxTop;

            break;
        }

        // 上下溢出检测
        const contentTopInFrame = baselineYFrame + bboxTop;
        const contentBottomInFrame = baselineYFrame + bboxBottom;

        const overflowTop = Math.max(0, -contentTopInFrame);
        const overflowBottom = Math.max(0, contentBottomInFrame - frameHpx);

        // 垂直扩张
        let expandTop = overflowTop;
        let expandBottom = overflowBottom;

        switch (layout.textVerticalAlign) {
          case spec.TextVerticalAlign.top: {
            const E = overflowBottom;

            expandTop = E;
            expandBottom = E;

            break;
          }
          case spec.TextVerticalAlign.bottom: {
            const E = overflowTop;

            expandTop = E;
            expandBottom = E;

            break;
          }
          case spec.TextVerticalAlign.middle: {
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

        // 1. 先按 frameWpx 计算每行的对齐起点（逻辑对齐）
        const xOffsetsFrame = lines.map(line =>
          layout.getOffsetXRich(this.textStyle, frameWpx, line.width)
        );

        // 2. 用对齐后的偏移 + 行宽算出内容的左右边界
        let contentMinX = Infinity;
        let contentMaxX = -Infinity;

        for (let i = 0; i < lines.length; i++) {
          const off = xOffsetsFrame[i] ?? 0;
          const w = lines[i].width ?? 0; // 像素宽

          contentMinX = Math.min(contentMinX, off);
          contentMaxX = Math.max(contentMaxX, off + w);
        }

        if (!isFinite(contentMinX)) {
          contentMinX = 0;
        }
        if (!isFinite(contentMaxX)) {
          contentMaxX = 0;
        }

        // 3. 计算内容相对于 frame 的越界量
        const overflowLeft = Math.max(0, -contentMinX);               // 内容左边 < 0
        const overflowRight = Math.max(0, contentMaxX - frameWpx);    // 内容右边 > frameWpx?

        // 4. 让 canvas 左右都扩张到能容下整个内容 bbox
        const expandLeft = overflowLeft;
        const expandRight = overflowRight;

        // 5. 最终 canvas 宽高
        const finalWpx = Math.ceil(frameWpx + expandLeft + expandRight);
        const finalHpx = Math.ceil(frameHpx + expandTop + expandBottom);

        // 记录补偿，供垂直对齐策略叠加
        sizeResult.baselineCompensationX = expandLeft;
        sizeResult.baselineCompensationY = compY;
        // containerWidth 用 frameWpx，而不是 finalWpx
        sizeResult.containerWidth = frameWpx;

        sizeResult.canvasWidth = finalWpx;
        sizeResult.canvasHeight = finalHpx;

        this.canvasSize = new math.Vector2(finalWpx, finalHpx);

        // 实际元素渲染尺寸不随着 fontScale 改变
        this.item.transform.size.set(
          finalWpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR,
          finalHpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR
        );
        this.initialized = true;

        break;
      }
      case spec.TextOverflow.clip: {
        const frameWpx = frameW * fontScale;
        const frameHpx = frameH * fontScale;

        // 直接使用 frame 尺寸作为画布尺寸
        sizeResult.canvasWidth = frameWpx;
        sizeResult.canvasHeight = frameHpx;

        // clip 模式不需要任何补偿
        sizeResult.baselineCompensationX = 0;
        sizeResult.baselineCompensationY = 0;

        // 设置 canvas 和节点变换
        this.canvasSize = new math.Vector2(frameWpx, frameHpx);

        // 把 layout 的尺寸更新为 frame 尺寸
        layout.width = frameW;
        layout.height = frameH;

        this.item.transform.size.set(
          frameWpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR,
          frameHpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR
        );
        this.initialized = true;

        break;
      }
      case spec.TextOverflow.display: {
        const frameWpx = frameW * fontScale;
        const frameHpx = frameH * fontScale;

        this.canvasSize = new math.Vector2(frameWpx, frameHpx);
        this.item.transform.size.set(
          frameWpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR,
          frameHpx / fontScale * this.SCALE_FACTOR * this.SCALE_FACTOR
        );
        this.initialized = true;

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
    singleLineHeight: number,
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
      // 为 visible 模式的画布尺寸计算保留行信息
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
    TextVerticalAlignResult: VerticalAlignResult,
    overflowResult: OverflowResult,
    textStyle: TextStyle
  ): void {
    let currentBaselineY = TextVerticalAlignResult.baselineY;
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
