/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { Color } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { canvasPool } from '../../canvas-pool';
import type { ItemRenderer } from '../../components';
import { MaskableGraphic } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { glContext } from '../../gl';
import type { Material } from '../../material';
import { Texture } from '../../texture';
import { applyMixins, isValidFontFamily } from '../../utils';
import type { VFXItem } from '../../vfx-item';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import type { SizeStrategy, OverflowStrategy, WarpStrategy } from './strategies/text-interfaces';
import { TextStrategyFactory } from './strategies/text-factory';
import { getFontDesc, DEFAULT_FONTS } from './strategies/text-utils';

interface CharInfo {
  /**
   * 段落 y 值
   */
  y: number,
  /**
   * 段落字符
   */
  chars: string[],
  charOffsetX: number[],
  /**
   * 段落宽度
   */
  width: number,
}

export interface TextComponent extends TextComponentBase { }

let seed = 0;

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TextComponent)
export class TextComponent extends MaskableGraphic {
  isDirty = true;
  /**
   * 文本行数
   */
  lineCount = 0;

  /**
   * 每一行文本的最大宽度
   */
  protected maxLineWidth = 0;
  protected readonly SCALE_FACTOR = 0.1;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  constructor (engine: Engine, props?: spec.TextComponentData) {
    super(engine);

    this.name = 'MText' + seed++;

    if (props) {
      this.fromData(props);
    }

    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

    if (!props) {
      return;
    }

    const { options } = props;

    this.updateWithOptions(options);
    this.updateTexture();
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    this.updateTexture();
  }

  override onDestroy (): void {
    super.onDestroy();
    this.disposeTextTexture();
  }

  override fromData (data: spec.TextComponentData): void {
    super.fromData(data);
    const { interaction, options } = data;

    this.interaction = interaction;

    // TextComponentBase
    this.updateWithOptions(options);
    this.renderText(options);

    // 恢复默认颜色
    this.material.setColor('_Color', new Color(1, 1, 1, 1));

  }

  updateWithOptions (options: spec.TextContentOptions) {
    // OVERRIDE by mixins
  }

  updateTexture (flipY = true) {
    // OVERRIDE by mixins
  }
}

export class TextComponentBase {
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: TextLayout;
  text: string;
  /***** mix 类型兼容用 *****/
  isDirty: boolean;
  engine: Engine;
  material: Material;
  lineCount: number;
  item: VFXItem;
  renderer: ItemRenderer;
  /***** mix 类型兼容用 *****/

  protected maxLineWidth: number;

  private char: string[];

  // 策略字段
  private sizeStrategy: SizeStrategy;
  private overflowStrategy: OverflowStrategy;
  private warpStrategy: WarpStrategy;

  protected renderText (options: spec.TextContentOptions) {
    this.updateTexture();
  }

  updateWithOptions (options: spec.TextContentOptions) {
    this.textStyle = new TextStyle(options);
    this.textLayout = new TextLayout(options);
    this.text = options.text.toString();

    // 初始化策略
    this.initializeStrategies();

    this.lineCount = this.getLineCount(options.text, true);
  }

  /**
   * 初始化策略
   */
  private initializeStrategies (): void {
    // 使用工厂创建尺寸策略
    this.sizeStrategy = TextStrategyFactory.createSizeStrategy(this.textLayout.autoWidth);

    // 使用工厂创建溢出策略
    this.overflowStrategy = TextStrategyFactory.createOverflowStrategy(this.textLayout.overflow);

    // 使用工厂创建包裹策略
    this.warpStrategy = TextStrategyFactory.createWarpStrategy(this.textLayout.wrap);
  }

  /**
   * 设置尺寸策略
   * @param strategy - 尺寸策略
   */
  setSizeStrategy (strategy: SizeStrategy): void {
    this.sizeStrategy = strategy;
    this.isDirty = true;
  }

  /**
   * 设置溢出策略
   * @param strategy - 溢出策略
   */
  setOverflowStrategy (strategy: OverflowStrategy): void {
    this.overflowStrategy = strategy;
    this.isDirty = true;
  }

  private getLineCount (text: string, init: boolean) {
    const context = this.context;

    if (!context) {
      return 1; // 如果context为null，返回默认行数1
    }

    // 确保warpStrategy已初始化
    if (!this.warpStrategy) {
      this.initializeStrategies();
    }

    const fontScale = init ? this.textStyle.fontSize / 10 : 1 / this.textStyle.fontScale;
    const availableWidth = this.textLayout.width + this.textStyle.fontOffset;

    // 使用WarpStrategy计算行数和最大行宽
    const result = this.warpStrategy.computeLineBreaks(
      text,
      availableWidth,
      context,
      this.textStyle,
      this.textLayout,
      fontScale
    );

    this.maxLineWidth = result.maxLineWidth;

    return result.lineCount;
  }

  /**
   * 设置字号大小
   * @param value - 字号
   * @returns
   */
  setFontSize (value: number): void {
    if (this.textStyle.fontSize === value) {
      return;
    }
    // 保证字号变化后位置正常
    const diff = this.textStyle.fontSize - value;

    this.textLayout.lineHeight += diff;
    this.textStyle.fontSize = value;

    this.isDirty = true;
  }

  /**
   * 设置字重
   * @param value - 字重类型
   * @returns
   */
  setFontWeight (value: spec.TextWeight): void {
    if (this.textStyle.textWeight === value) {
      return;
    }
    this.textStyle.textWeight = value;
    this.isDirty = true;
  }

  /**
   * 设置字体样式
   * @param value 设置字体样式
   * @default "normal"
   * @returns
   */
  setFontStyle (value: spec.FontStyle): void {
    if (this.textStyle.fontStyle === value) {
      return;
    }
    this.textStyle.fontStyle = value;
    this.isDirty = true;
  }

  /**
   * 设置文本
   * @param value - 文本内容
   * @returns
   */
  setText (value: string): void {
    if (this.text === value) {
      return;
    }
    this.text = value.toString();
    this.lineCount = this.getLineCount(value, false);
    this.isDirty = true;
  }

  /**
   * 设置文本水平布局
   * @param value - 布局选项
   * @returns
   */
  setTextAlign (value: spec.TextAlignment): void {
    if (this.textLayout.textAlign === value) {
      return;
    }
    this.textLayout.textAlign = value;
    this.isDirty = true;
  }

  /**
   * 设置文本垂直布局
   * @param value - 布局选项
   * @returns
   */
  setTextBaseline (value: spec.TextBaseline): void {
    if (this.textLayout.textBaseline === value) {
      return;
    }
    this.textLayout.textBaseline = value;
    this.isDirty = true;
  }

  /**
   * 设置文本颜色
   * @param value - 颜色内容
   * @returns
   */
  setTextColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.textColor === value) {
      return;
    }
    this.textStyle.textColor = value;
    this.isDirty = true;
  }

  /**
   * 设置文本字体
   * @param value - 文本字体
   * @returns
   */
  setFontFamily (value: string): void {
    if (this.textStyle.fontFamily === value && !isValidFontFamily(value)) {
      console.warn('The font is either the current font or an risky font family.');

      return;
    }
    this.textStyle.fontFamily = value;
    this.isDirty = true;
  }

  /**
   * 设置外描边文本颜色
   * @param value - 颜色内容
   * @returns
   */
  setOutlineColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.outlineColor === value) {
      return;
    }
    this.textStyle.outlineColor = value;
    this.isDirty = true;
  }

  /**
   * 设置外描边文本宽度
   * @param value - 外描边宽度
   * @returns
   */
  setOutlineWidth (value: number): void {
    if (this.textStyle.outlineWidth === value) {
      return;
    }
    this.textStyle.outlineWidth = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影模糊
   * @param value - 阴影模糊强度
   * @returns
   */
  setShadowBlur (value: number): void {
    if (this.textStyle.shadowBlur === value) {
      return;
    }
    this.textStyle.shadowBlur = value;
    this.isDirty = true;
  }

  /**
   * 设置文本溢出模式
   *
   * - clip: 当文本内容超出边界框时，多余的会被截断。
   * - display: 该模式下会显示所有文本，会自动调整文本字号以保证显示完整。
   * > 当存在多行时，部分行内文本可能存在文本字号变小的情况，其他行为正常情况
   *
   * @param overflow - 文本溢出模式
   */
  setOverflow (overflow: spec.TextOverflow) {
    if (this.textLayout.overflow === overflow) {
      return;
    }

    this.textLayout.overflow = overflow;

    // 使用工厂更新溢出策略
    this.overflowStrategy = TextStrategyFactory.createOverflowStrategy(overflow);

    this.isDirty = true;
  }

  /**
   * 设置阴影颜色
   * @param value - 阴影颜色
   * @returns
   */
  setShadowColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.shadowColor === value) {
      return;
    }
    this.textStyle.shadowColor = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影水平偏移距离
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetX (value: number): void {
    if (this.textStyle.shadowOffsetX === value) {
      return;
    }
    this.textStyle.shadowOffsetX = value;
    this.isDirty = true;
  }

  /**
   * 设置阴影水平偏移距离
   * @param value - 水平偏移距离
   * @returns
   */
  setShadowOffsetY (value: number): void {
    if (this.textStyle.shadowOffsetY === value) {
      return;
    }
    this.textStyle.shadowOffsetY = value;
    this.isDirty = true;
  }

  /**
   * 设置字体清晰度
   * @param value - 字体清晰度
   * @returns
   */
  setFontScale (value: number): void {
    if (this.textStyle.fontScale === value) {
      return;
    }

    this.textStyle.fontScale = value;
    this.isDirty = true;
  }

  /**
   * 设置自适应宽高开关
   * @param value - 是否自适应宽高开关
   * @returns
   */
  setAutoWidth (value: boolean): void {
    if (this.textLayout.autoWidth === value) {
      return;
    }

    this.textLayout.autoWidth = value;
    // 根据autoWidth更新warp状态
    this.textLayout.wrap = !value;

    // 使用工厂更新尺寸策略
    this.sizeStrategy = TextStrategyFactory.createSizeStrategy(value);
    // 使用工厂更新包裹策略
    this.warpStrategy = TextStrategyFactory.createWarpStrategy(this.textLayout.wrap);

    this.isDirty = true;
  }

  /**
   * 更新文本
   * @returns
   */
  updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }
    const context = this.context;
    const style = this.textStyle;
    const layout = this.textLayout;
    const fontScale = style.fontScale;

    // 使用尺寸策略计算大小
    const { width, height: calculatedHeight, transformScaleY } = this.sizeStrategy.calculateSize(
      this.text, layout, style, context, this.lineCount
    );

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    style.fontDesc = getFontDesc(fontSize, style);
    this.char = (this.text || '').split('');
    this.canvas.width = width;

    // 设置 canvas 高度和 transform
    this.canvas.height = calculatedHeight;
    this.item.transform.size.set(1, transformScaleY);

    const height = this.canvas.height;

    // fix bug 1/255
    context.fillStyle = 'rgba(255, 255, 255, 0.0039)';

    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    // 使用溢出策略设置字体
    this.overflowStrategy.apply(context, layout, style, this.text, this.maxLineWidth);

    context.clearRect(0, 0, width, height);

    if (style.hasShadow) {
      this.setupShadow();
    }

    if (style.isOutlined) {
      this.setupOutline();
    }

    // 文本颜色
    context.fillStyle = `rgba(${style.textColor[0]}, ${style.textColor[1]}, ${style.textColor[2]}, ${style.textColor[3]})`;
    const charsInfo: CharInfo[] = [];

    let x = 0;
    let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);
    let charsArray = [];
    let charOffsetX = [];

    for (let i = 0; i < this.char.length; i++) {
      const str = this.char[i];
      const textMetrics = context.measureText(str);

      // 和浏览器行为保持一致
      x += layout.letterSpace * fontScale;

      if (((x + textMetrics.width) > width && i > 0) || str === '\n') {
        charsInfo.push({
          y,
          width: x,
          chars: charsArray,
          charOffsetX,
        });
        x = 0;
        y += lineHeight;
        charsArray = [];
        charOffsetX = [];
      }

      if (str !== '\n') {
        charsArray.push(str);
        charOffsetX.push(x);

        x += textMetrics.width;
      }
    }
    charsInfo.push({
      y,
      width: x,
      chars: charsArray,
      charOffsetX,
    });

    charsInfo.forEach(charInfo => {
      const x = layout.getOffsetX(style, charInfo.width);

      charInfo.chars.forEach((str, i) => {
        if (style.isOutlined) {
          context.strokeText(str, x + charInfo.charOffsetX[i], charInfo.y);
        }

        context.fillText(str, x + charInfo.charOffsetX[i], charInfo.y);
      });
    });

    if (style.hasShadow) {
      context.shadowColor = 'transparent';
    }

    //与 toDataURL() 两种方式都需要像素读取操作
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

    this.disposeTextTexture();

    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);

    this.isDirty = false;
  }

  protected disposeTextTexture () {
    const texture = this.renderer.texture;

    if (texture && texture !== this.engine.whiteTexture) {
      texture.dispose();
    }
  }

  private getFontDesc (size?: number): string {
    const { fontSize, fontScale, fontFamily, textWeight, fontStyle } = this.textStyle;
    let fontDesc = `${(size || fontSize * fontScale).toString()}px `;

    if (!DEFAULT_FONTS.includes(fontFamily)) {
      fontDesc += `"${fontFamily}"`;
    } else {
      fontDesc += fontFamily;
    }
    if (textWeight !== spec.TextWeight.normal) {
      fontDesc = `${textWeight} ${fontDesc}`;
    }

    if (fontStyle !== spec.FontStyle.normal) {
      fontDesc = `${fontStyle} ${fontDesc}`;
    }

    return fontDesc;
  }

  private setupOutline (): void {
    const context = this.context;
    const { outlineColor, outlineWidth } = this.textStyle;
    const [r, g, b, a] = outlineColor;

    if (context) {
      context.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      context.lineWidth = outlineWidth * 2;
    }
  }

  private setupShadow (): void {
    const context = this.context;
    const { outlineColor, shadowBlur, shadowOffsetX, shadowOffsetY } = this.textStyle;
    const [r, g, b, a] = outlineColor;

    if (context) {
      context.shadowColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      context.shadowBlur = shadowBlur;
      context.shadowOffsetX = shadowOffsetX;
      context.shadowOffsetY = -shadowOffsetY;
    }
  }
}

applyMixins(TextComponent, [TextComponentBase]);
