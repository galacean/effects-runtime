/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { Color } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { canvasPool } from '../../canvas-pool';
import { MaskableGraphic } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { applyMixins } from '../../utils';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import type { ITextComponent } from './text-component-base';
import { TextComponentBase } from './text-component-base';

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

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
export class TextComponent extends MaskableGraphic implements ITextComponent {
  isDirty = true;
  /**
   * 文本行数
   */
  lineCount = 0;
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: TextLayout;
  text: string;

  /**
   * 每一行文本的最大宽度
   */
  protected maxLineWidth = 0;

  /**
   * 初始文本宽度，用于计算缩放比例
   */
  private baseTextWidth = 0;

  /**
   * 初始 `transform.size.x`，用于按比例更新显示宽度
   */
  private baseScaleX = 1;

  private getDefaultProps (): spec.TextComponentData {
    return {
      id: `default-id-${Math.random().toString(36).substr(2, 9)}`,
      item: { id: `default-item-${Math.random().toString(36).substr(2, 9)}` },
      dataType: spec.DataType.TextComponent,
      options: {
        text: '默认文本',
        fontFamily: 'AlibabaSans-BoldItalic',
        fontSize: 40,
        // 统一使用 0-1 颜色值
        textColor: [1, 1, 1, 1],
        fontWeight: spec.TextWeight.normal,
        letterSpace: 0,
        textAlign: 1,
        fontStyle: spec.FontStyle.normal,
        autoWidth: false,
        textWidth: 200,
        textHeight: 42,
        lineHeight: 40.148,
      },
      renderer: {
        renderMode: 1,
        anchor: [0.5, 0.5],
      },
    };
  }

  constructor (engine: Engine) {
    super(engine);

    this.name = 'MText' + seed++;

    // 初始化canvas资源
    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

    // 使用默认值初始化
    const defaultData = this.getDefaultProps();

    const { options } = defaultData;

    this.updateWithOptions(options);
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

    this.resetState();

    // TextComponentBase
    this.updateWithOptions(options);
    this.renderText(options);

    // 记录初始的 textWidth 和 x 缩放，用于后续按比例更新显示宽度
    // 添加兜底值 1 防止除 0
    this.baseTextWidth = options.textWidth || this.textLayout.width || 1;
    this.baseScaleX = this.item.transform.size.x;

    // 恢复默认颜色
    this.material.setColor('_Color', new Color(1, 1, 1, 1));
  }

  private resetState (): void {
    // 清理纹理资源
    this.disposeTextTexture();

    // 重置状态变量
    this.isDirty = true;
    this.lineCount = 0;
    this.maxLineWidth = 0;
  }

  // 在 TextComponent 类内新增覆盖 setText
  setText (value: string): void {
    if (this.text === value) {
      return;
    }
    this.text = value.toString();
    // 设置文本后立即重算行数
    this.lineCount = this.getLineCount(this.text);
    this.isDirty = true;
  }

  /**
   * 根据配置更新文本样式和布局
   */
  updateWithOptions (options: spec.TextContentOptions): void {
    // 初始化 textStyle 和 textLayout
    if (!this.textStyle) {
      this.textStyle = new TextStyle(options);
    } else {
      this.textStyle.update(options);
    }

    if (!this.textLayout) {
      this.textLayout = new TextLayout(options);
    } else {
      this.textLayout.update(options);
    }

    this.text = options.text.toString();
    this.lineCount = this.getLineCount(options.text);
  }

  getLineCount (text: string): number {
    const context = this.context;
    const { letterSpace, overflow } = this.textLayout;

    // const fontScale = init ? this.textStyle.fontSize / 10 : 1 / this.textStyle.fontScale;
    this.maxLineWidth = 0;
    const width = (this.textLayout.width + this.textStyle.fontOffset);
    let lineCount = 1;
    let x = 0;

    // 设置 context.font 的字号，确保 measureText 能正确计算字宽
    if (context) {
      context.font = this.getFontDesc(this.textStyle.fontSize);
    }
    for (let i = 0; i < text.length; i++) {
      const str = text[i];
      const textMetrics = context?.measureText(str)?.width ?? 0;

      // 和浏览器行为保持一致
      x += letterSpace;
      // 处理文本结束行为
      if (overflow === spec.TextOverflow.display) {
        if (str === '\n') {
          lineCount++;
          x = 0;
        } else {
          x += textMetrics;
          this.maxLineWidth = Math.max(this.maxLineWidth, x);
        }
      } else {
        if (((x + textMetrics) > width && i > 0) || str === '\n') {
          lineCount++;
          this.maxLineWidth = Math.max(this.maxLineWidth, x);
          x = 0;
        }
        if (str !== '\n') {
          x += textMetrics;
        }
      }
    }

    return lineCount;
  }

  /**
   * 设置行高
   * 行高表示每行占用的总高度
   * @param value - 行高像素值
   */
  setLineHeight (value: number): void {
    const fontSize = this.textStyle.fontSize;
    //设置行高不能小于字号大小
    const safe = Math.max(fontSize, value);

    if (this.textLayout.lineHeight === safe) {
      return;
    }

    this.textLayout.lineHeight = safe;
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
   * 更新文本
   * @returns
   */
  protected updateTexture (flipY = true): void {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }

    const style = this.textStyle;
    const layout = this.textLayout;
    const fontScale = style.fontScale;

    const width = (layout.width + style.fontOffset) * fontScale;
    const finalHeight = layout.lineHeight * this.lineCount;

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    style.fontDesc = this.getFontDesc(fontSize);
    const char = (this.text || '').split('');

    if (layout.autoWidth) {
      this.canvas.height = finalHeight * fontScale;
      this.item.transform.size.set(1, finalHeight / layout.height);
    } else {
      this.canvas.height = layout.height * fontScale;
    }

    const height = this.canvas.height;

    this.renderToTexture(width, height, flipY, context => {
      // canvas size 变化后重新刷新 context
      if (this.maxLineWidth > width && layout.overflow === spec.TextOverflow.display) {
        context.font = this.getFontDesc(fontSize * width / this.maxLineWidth);
      } else {
        context.font = style.fontDesc;
      }

      if (style.hasShadow) {
        this.setupShadow();
      }

      if (style.isOutlined) {
        this.setupOutline();
      }

      // textColor 统一是 0-1，写入 canvas 时乘 255
      const [r, g, b, a] = style.textColor;

      context.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;

      const charsInfo: CharInfo[] = [];
      let x = 0;
      let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);
      let charsArray = [];
      let charOffsetX = [];

      for (let i = 0; i < char.length; i++) {
        const str = char[i];
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
    });

    this.isDirty = false;
  }

  renderText (options: spec.TextContentOptions) {
    this.updateTexture();
  }

  setAutoWidth (value: boolean): void {
    const layout = this.textLayout;
    const normalizedValue = !!value;

    if (layout.autoWidth === normalizedValue) {
      return;
    }
    layout.autoWidth = normalizedValue;
    this.isDirty = true;
  }

  /**
   * 设置文本框宽度
   * 手动设置宽度时会自动关闭 `autoWidth`
   * 同时会按比例更新 `transform.size.x`，让 UI 框宽度也跟着变化
   * @param value - 文本框宽度
   */
  setTextWidth (value: number): void {
    const width = Math.max(0, Number(value) || 0);
    const layout = this.textLayout;

    // 宽度没变且已是非 autoWidth 模式,直接返回
    if (layout.width === width && layout.autoWidth === false) {
      return;
    }

    // 手动设置宽度时关闭 autoWidth
    layout.autoWidth = false;
    layout.width = width;

    // 按当前 overflow 模式重新计算行数和 maxLineWidth
    this.lineCount = this.getLineCount(this.text || '');
    this.isDirty = true;

    // 同步更新外层显示宽度(按比例缩放 transform)
    // 这样 UI 框的视觉宽度也会跟着文本宽度变化
    if (this.baseTextWidth > 0) {
      const scale = width / this.baseTextWidth;

      this.item.transform.size.x = this.baseScaleX * scale;
    }
  }

  /**
   * 设置文本框高度
   * @param value - 文本框高度
   */
  setTextHeight (value: number): void {
    const height = Math.max(0, Number(value) || 0);

    if (height === 0) {
      return;
    }

    const layout = this.textLayout;

    if (layout.height === height) {
      return;
    }

    layout.height = height;
    this.isDirty = true;
  }

  setFontSize (value: number): void {
    if (this.textStyle.fontSize === value) {
      return;
    }
    // 保证字号变化后位置正常
    const diff = this.textStyle.fontSize - value;
    const layout = this.textLayout;

    layout.lineHeight += diff;
    this.textStyle.fontSize = value;
    this.isDirty = true;
  }

  setOutlineWidth (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.textStyle.outlineWidth === v) {
      return;
    }
    this.textStyle.outlineWidth = v;
    this.isDirty = true;
  }

  setShadowBlur (value: number): void {
    const v = Math.max(0, Number(value) || 0);

    if (this.textStyle.shadowBlur === v) {
      return;
    }
    this.textStyle.shadowBlur = v;
    this.isDirty = true;
  }

  // setupShadow 使用 outlineColor 作为阴影颜色，更新 shadowColor 不影响阴影颜色
  setShadowColor (value: spec.RGBAColorValue): void {
    const v = value ?? [0, 0, 0, 1];

    if (this.textStyle.shadowColor === v) {
      return;
    }
    this.textStyle.shadowColor = v;
    this.isDirty = true;
  }

  setShadowOffsetX (value: number): void {
    const v = Number(value) || 0;

    if (this.textStyle.shadowOffsetX === v) {
      return;
    }
    this.textStyle.shadowOffsetX = v;
    this.isDirty = true;
  }

  setShadowOffsetY (value: number): void {
    const v = Number(value) || 0;

    if (this.textStyle.shadowOffsetY === v) {
      return;
    }
    this.textStyle.shadowOffsetY = v;
    this.isDirty = true;
  }
}

applyMixins(TextComponent, [TextComponentBase]);
