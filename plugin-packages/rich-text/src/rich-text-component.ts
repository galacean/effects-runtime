/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { Engine, FancyScopeResolution, IRichTextComponent, TextRenderPlan } from '@galacean/effects';
import {
  assertExist, math, effectsClass, spec, MaskableGraphic, applyMixins, TextStyle,
  TextComponentBase, compileTextEffectPlan,
} from '@galacean/effects';
import { RichTextLayout } from './rich-text-layout';
import { RichTextStrategyFactory } from './strategies/rich-text-factory';
import type {
  RichWrapStrategy, RichOverflowStrategy, RichHorizontalAlignStrategy, RichVerticalAlignStrategy,
} from './strategies/rich-text-interfaces';
import { scaleLinesToFit } from './strategies/rich-text-interfaces';
import {
  parseRichTextOptions,
  type RichTextContentOptions,
  type RichTextOptions,
  type RichTextRangeFancyLayers,
} from './rich-text-options';
import { buildRichTextRenderPlan } from './rich-text-render-plan';
import { CanvasRichTextFancyBackend, calculateTextEffectPadding, type TextEffectPadding } from './rich-text-fancy-backend';

export type { RichTextContentOptions, RichTextOptions } from './rich-text-options';

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
  /** @deprecated Use for legacy mode*/
  private singleLineHeight: number = 1.571;
  /** @deprecated Use for legacy mode*/
  private size: math.Vector2 | null = null;
  /** @deprecated Use for legacy mode*/
  private initialized: boolean = false;
  /** @deprecated Use for legacy mode*/
  private canvasSize: math.Vector2 | null = null;

  private richWrapStrategy: RichWrapStrategy;
  private richOverflowStrategy: RichOverflowStrategy;
  private richHorizontalAlignStrategy: RichHorizontalAlignStrategy;
  private richVerticalAlignStrategy: RichVerticalAlignStrategy;

  protected readonly SCALE_FACTOR = 0.11092565;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;
  protected effectScaleX = 1;
  protected effectScaleY = 1;
  private lastRenderPlan?: TextRenderPlan;
  private rangeFancyLayers: RichTextRangeFancyLayers = {};
  private fancyResolution?: FancyScopeResolution;
  /** Runtime-only padding budget for interactive/animated fancy parameters. */
  private fancyRenderPadding: Partial<TextEffectPadding> = {};
  /** Keeps the render surface stable while interactive fancy parameters change. */
  private stableEffectPadding?: TextEffectPadding;

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

    for (const material of this.materials) {
      material.setVector2('_Size', new math.Vector2(
        this.transform.size.x * this.effectScaleX,
        this.transform.size.y * this.effectScaleY,
      ));
    }
  }

  /**
   * Returns the most recent plan produced by the strategy renderer.
   *
   * This is intentionally read-only at the component boundary and is mainly
   * useful for diagnostics and demo tooling; the Canvas backend owns execution.
   */
  getRenderPlan (): TextRenderPlan | undefined {
    return this.lastRenderPlan;
  }

  override onDestroy (): void {
    this._destroyed = true;
    this.lastRenderPlan = undefined;
    this.stableEffectPadding = undefined;
    super.onDestroy();
    this.disposeTextTexture();
  }

  override fromData (data: spec.RichTextComponentData): void {
    super.fromData(data);
    const { interaction, options } = data;

    this.interaction = interaction;

    this.updateWithOptions(options);
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

  private generateTextProgram (text: string): void {
    this.processedTextOptions = parseRichTextOptions(text, this.textStyle, this.rangeFancyLayers, this.fancyResolution);
  }

  /**
   * 根据配置更新文本样式和布局
   */
  updateWithOptions (options: RichTextContentOptions): void {
    const richOptions = options;

    const nextText = options.text ? options.text.toString() : ' ';

    if (nextText !== this.text) {
      this.stableEffectPadding = undefined;
    }

    this.rangeFancyLayers = richOptions.rangeFancyLayers ?? {};
    this.fancyRenderPadding = richOptions.fancyRenderPadding ?? {};
    this.textStyle = new TextStyle(options);
    this.fancyResolution = this.textStyle.fancyConfig
      && (this.textStyle.fancyConfig.rangeStacks || this.textStyle.fancyConfig.rangeOverrides)
      ? TextStyle.resolveFancyConfig(
        this.textStyle.fancyConfig,
        this.textStyle.textColor,
        this.textStyle.fancyRenderStyle.layers,
      )
      : undefined;
    this.textLayout = new RichTextLayout(options);
    this.text = nextText;
    // TextLayout 构造函数已经正确处理了 textVerticalAlign，这里不需要再设置
    if (this.textLayout.useLegacyRichText) {
      this.textLayout.textVerticalAlign = spec.TextVerticalAlign.middle;
    }
    void this.loadFancyTexturePatterns();
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
    this.lastRenderPlan = undefined;

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
          // TextStyle normalizes base colors to 0..1, while legacy rich-text
          // data may still carry 0..255 range colors. Keep both forms visible
          // in the legacy Canvas path.
          const colorScale = [r, g, b].some(channel => channel > 1) ? 1 : 255;

          context.fillStyle = `rgba(${r * colorScale}, ${g * colorScale}, ${b * colorScale}, ${a})`;

          context.fillText(text, strOffsetX, charsLineHeight);
        });
      });
    });

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

    this.updateStrategies();

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

    // ── 步骤 1: 换行策略（逻辑坐标系，fontScale 不参与排版）──
    const wrapResult = this.richWrapStrategy.computeLines(
      this.processedTextOptions,
      context,
      this.textStyle,
      layout,
      letterSpace,
    );

    // ── 步骤 2: SizeMode → 帧尺寸（逻辑单位）──
    // fontScale 不参与排版，全部在逻辑坐标系中完成。
    let frameW: number;
    let frameH: number;

    switch (layout.autoResize) {
      case spec.TextSizeMode.autoWidth:
        frameW = Math.max(1, wrapResult.maxLineWidth || 0);
        frameH = Math.max(1, wrapResult.totalHeight || 0);

        break;
      case spec.TextSizeMode.autoHeight:
        frameW = layout.maxTextWidth;
        frameH = Math.max(1, wrapResult.totalHeight || 0);

        break;
      case spec.TextSizeMode.fixed:
      default:
        frameW = layout.maxTextWidth;
        frameH = layout.maxTextHeight;

        break;
    }

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
    );

    // ── 步骤 5: 溢出 / 画布解析（不依赖对齐模式枚举）──
    const overflowResult = this.richOverflowStrategy.resolveCanvas(
      wrapResult.lines,
      frameW,
      frameH,
      horizontalAlignResult,
      verticalAlignResult,
    );

    const resolvedRangeLayers: RichTextRangeFancyLayers = { ...this.rangeFancyLayers };

    for (const options of this.processedTextOptions) {
      if (options.rangeFancyLayers && !resolvedRangeLayers[options.sourceRangeId]) {
        resolvedRangeLayers[options.sourceRangeId] = options.rangeFancyLayers;
      }
    }

    const effectPlan = compileTextEffectPlan({
      defaultLayers: this.textStyle.fancyRenderStyle.layers,
      rangeLayersBySourceId: resolvedRangeLayers,
    });
    const requestedPadding = calculateTextEffectPadding(this.textStyle, resolvedRangeLayers);
    const padding = this.mergeEffectPadding(requestedPadding);
    const paddedLogicalWidth = overflowResult.canvasWidth + padding.left + padding.right;
    const paddedLogicalHeight = overflowResult.canvasHeight + padding.top + padding.bottom;

    // 排版结果（逻辑单位）→ 包含花字扩展后的物理像素画布
    const physicalW = Math.max(1, Math.ceil(paddedLogicalWidth * fontScale));
    const physicalH = Math.max(1, Math.ceil(paddedLogicalHeight * fontScale));

    this.effectScaleX = overflowResult.canvasWidth > 0
      ? paddedLogicalWidth / overflowResult.canvasWidth
      : 1;
    this.effectScaleY = overflowResult.canvasHeight > 0
      ? paddedLogicalHeight / overflowResult.canvasHeight
      : 1;

    // 渲染尺寸不随 fontScale 改变；quad 通过 effectScale 扩展匹配纹理。
    this.item.transform.size.set(
      overflowResult.canvasWidth * this.SCALE_FACTOR * this.SCALE_FACTOR,
      overflowResult.canvasHeight * this.SCALE_FACTOR * this.SCALE_FACTOR
    );

    // 统一回写布局属性（逻辑单位）
    layout.maxTextWidth = frameW;
    layout.maxTextHeight = frameH;
    layout.width = overflowResult.canvasWidth;
    layout.height = overflowResult.canvasHeight;

    const renderPlan = buildRichTextRenderPlan({
      textStyle: this.textStyle,
      wrapResult,
      horizontalAlignResult,
      verticalAlignResult,
      overflowResult,
      effectPlan,
      logicalSize: { width: paddedLogicalWidth, height: paddedLogicalHeight },
      renderSize: { width: physicalW, height: physicalH },
      renderScale: fontScale,
      padding,
    });

    this.lastRenderPlan = renderPlan;
    const allLayers = [
      ...this.textStyle.fancyRenderStyle.layers,
      ...Object.keys(resolvedRangeLayers).reduce<RichTextRangeFancyLayers[string]>((all, key) => all.concat(resolvedRangeLayers[key] ?? []), []),
    ];

    const backend = new CanvasRichTextFancyBackend({
      textureLayers: allLayers,
    });

    this.renderToTexture(physicalW, physicalH, flipY, context => {
      // fontScale 仅作为渲染分辨率倍率，排版坐标全部为逻辑单位
      context.scale(fontScale, fontScale);
      context.translate(padding.left, padding.top);
      // ── 步骤 6: 绘制 ──
      backend.render(renderPlan, context);
    }, { reuseExisting: true });

    this.isDirty = false;
  }

  private mergeEffectPadding (requested: TextEffectPadding): TextEffectPadding {
    const hasBudget = Object.keys(this.fancyRenderPadding).length > 0;

    if (!hasBudget) {
      // Keep the legacy/non-interactive path exact: without an explicit budget
      // there is no reason to retain a previous larger surface forever.
      this.stableEffectPadding = undefined;

      return requested;
    }

    const budgeted: TextEffectPadding = {
      left: Math.max(requested.left, this.fancyRenderPadding.left ?? 0),
      right: Math.max(requested.right, this.fancyRenderPadding.right ?? 0),
      top: Math.max(requested.top, this.fancyRenderPadding.top ?? 0),
      bottom: Math.max(requested.bottom, this.fancyRenderPadding.bottom ?? 0),
    };

    if (!this.stableEffectPadding) {
      this.stableEffectPadding = budgeted;
    } else {
      this.stableEffectPadding = {
        left: Math.max(this.stableEffectPadding.left, budgeted.left),
        right: Math.max(this.stableEffectPadding.right, budgeted.right),
        top: Math.max(this.stableEffectPadding.top, budgeted.top),
        bottom: Math.max(this.stableEffectPadding.bottom, budgeted.bottom),
      };
    }

    return this.stableEffectPadding;
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
