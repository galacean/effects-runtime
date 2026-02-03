/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { Color, Vector2 } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { canvasPool } from '../../canvas-pool';
import { MaskableGraphic } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { applyMixins } from '../../utils';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import { TextComponentBase } from './text-component-base';
import type { Renderer } from '../../render/renderer';

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
export class TextComponent extends MaskableGraphic {
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
   * 描边/阴影等特效导致的纹理扩容比例 X/Y
   */
  protected effectScaleX = 1;
  protected effectScaleY = 1;

  /**
   * 每一行文本的最大宽度
   */
  protected maxLineWidth = 0;

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

    // 覆盖基类每帧更新 size 行为，应用扩容比例
    for (const material of this.materials) {
      let sizeX = this.transform.size.x;
      let sizeY = this.transform.size.y;
      const [scalex, scaley] = this.getTextureExpandScale();

      sizeX *= scalex;
      sizeY *= scaley;

      material.setVector2('_Size', new Vector2(sizeX, sizeY));
    }
  }

  override render (renderer: Renderer) {
    this.maskManager.drawStencilMask(renderer);

    renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.material);
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

    if (layout.autoResize === spec.TextSizeMode.autoWidth) {
      layout.width = this.getTextWidth();
      layout.height = layout.lineHeight;
      this.lineCount = 1;
    } else {
      this.lineCount = this.getLineCount(this.text);
    }

    const baseWidth = (layout.width + style.fontOffset) * fontScale;
    const baseHeight = layout.height * fontScale;

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    style.fontDesc = this.getFontDesc(fontSize);
    // 使用 Array.from 正确分割 Unicode 字符（包括 emoji）
    const char = Array.from(this.text || '');

    const { padL, padR, padT, padB } = this.getEffectPadding();
    const hasEffect = (padL | padR | padT | padB) !== 0;

    const texWidth = hasEffect ? Math.ceil(baseWidth + padL + padR) : baseWidth;
    const texHeight = hasEffect ? Math.ceil(baseHeight + padT + padB) : baseHeight;

    const shiftX = hasEffect ? padL : 0;
    const shiftY = hasEffect ? (flipY ? padT : padB) : 0;

    // 给渲染层用：扩容比例
    this.effectScaleX = baseWidth > 0 ? (texWidth / baseWidth) : 1;
    this.effectScaleY = baseHeight > 0 ? (texHeight / baseHeight) : 1;

    // 默认 camera 下的 world per pixel
    const scaleFactor = 0.11092565;
    const scaleFactor2 = scaleFactor * scaleFactor;

    this.transform.setSize(baseWidth * scaleFactor2 / fontScale, baseHeight * scaleFactor2 / fontScale);

    this.renderToTexture(texWidth, texHeight, flipY, context => {
      // canvas size 变化后重新刷新 context
      if (this.maxLineWidth > baseWidth && layout.overflow === spec.TextOverflow.display) {
        context.font = this.getFontDesc(fontSize * baseWidth / this.maxLineWidth);
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

        if (((x + textMetrics.width) > baseWidth && i > 0) || str === '\n') {
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

      // 先描边
      if (style.isOutlined && style.outlineWidth > 0) {
        charsInfo.forEach(charInfo => {
          const ox = layout.getOffsetX(style, charInfo.width);

          for (let i = 0; i < charInfo.chars.length; i++) {
            const str = charInfo.chars[i];
            const drawX = shiftX + ox + charInfo.charOffsetX[i];
            const drawY = shiftY + charInfo.y;

            context.strokeText(str, drawX, drawY);
          }
        });
      }

      // 再填充
      charsInfo.forEach(charInfo => {
        const ox = layout.getOffsetX(style, charInfo.width);

        for (let i = 0; i < charInfo.chars.length; i++) {
          const str = charInfo.chars[i];
          const drawX = shiftX + ox + charInfo.charOffsetX[i];
          const drawY = shiftY + charInfo.y;

          context.fillText(str, drawX, drawY);
        }
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

  /**
   * 给渲染层用：获取特效扩容比例（描边/阴影导致的纹理扩容）
   * @returns
   */
  public getTextureExpandScale (): [number, number] {
    return [this.effectScaleX, this.effectScaleY];
  }

  /**
   * 获取描边和阴影的 padding 值（单位：px）
   * @returns
   */
  protected getEffectPadding () {
    const style = this.textStyle;

    const hasDrawOutline = style.isOutlined && style.outlineWidth > 0;
    const outlinePad = hasDrawOutline ? Math.ceil(style.outlineWidth * 2 * style.fontScale) : 0;

    const hasShadow = style.hasShadow && (style.shadowBlur > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0);
    const shadowPad = hasShadow
      ? Math.ceil((Math.abs(style.shadowOffsetX) + Math.abs(style.shadowOffsetY) + style.shadowBlur) * style.fontScale)
      : 0;

    const pad = outlinePad + shadowPad;

    return { padL: pad, padR: pad, padT: pad, padB: pad };
  }

  setAutoResize (value: spec.TextSizeMode): void {
    if (this.textLayout.autoResize === value) {
      return;
    }
    this.textLayout.autoResize = value;
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
    if (layout.width === width && layout.autoResize === spec.TextSizeMode.autoWidth) {
      return;
    }

    // 手动设置宽度时关闭 autoWidth
    layout.autoResize = spec.TextSizeMode.autoHeight;
    layout.width = width;

    // 按当前 overflow 模式重新计算 maxLineWidth
    this.isDirty = true;
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
    const size = Math.max(1, Number(value) || 1);

    if (this.textStyle.fontSize === size) {
      return;
    }

    this.textStyle.fontSize = size;
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

  /**
   * 设置是否启用文本描边
   * @param value - 是否启用描边
   * @returns
   */
  setOutlineEnabled (value: boolean): void {
    if (this.textStyle.isOutlined === value) {
      return;
    }
    this.textStyle.isOutlined = value;
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

  /**
   * 计算文本在当前样式与布局规则下的建议宽度（逻辑像素）。
   *
   * 说明：
   * - 使用 Canvas 2D 的 measureText，并按当前实现的逐字符排版规则累加宽度（与 updateTexture 保持一致）。
   * - 结果为"逻辑宽度"（已除去 fontScale，并扣除 fontOffset），可直接写回 options.textWidth。
   * - 通过 padding 追加少量冗余像素，用于降低边缘裁切风险。
   *
   * @returns 文本宽度（>= 0）
   */
  getTextWidth (): number {
    const ctx = this.context;

    if (!ctx) {return this.textLayout?.width ?? 0;}

    const text = (this.text ?? '').toString();
    const layout = this.textLayout;
    const style = this.textStyle;

    const fontScale = style.fontScale || 1;
    const renderFontSize = style.fontSize * fontScale;

    // 与 updateTexture 一致：用 render 字号测量
    ctx.font = this.getFontDesc(renderFontSize);

    let maxLineWidthRender = 0;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (ch === '\n') {
        maxLineWidthRender = Math.max(maxLineWidthRender, x);
        x = 0;
        continue;
      }

      // 与 updateTexture 一致：每个字符前加一次 letterSpace * fontScale
      x += (layout.letterSpace || 0) * fontScale;
      x += ctx.measureText(ch).width;
    }

    maxLineWidthRender = Math.max(maxLineWidthRender, x);

    // render -> 逻辑宽度
    const logicalMax = maxLineWidthRender / fontScale;

    // 反推 layout.width：renderWidth = (layout.width + fontOffset) * fontScale
    const padding = 2;
    const EPS = 1e-4;

    const w = Math.ceil(logicalMax - (style.fontOffset || 0) - EPS) + padding;

    return Math.max(0, w);
  }

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
}

applyMixins(TextComponent, [TextComponentBase]);
