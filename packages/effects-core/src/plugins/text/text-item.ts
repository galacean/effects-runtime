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

/** 检测字符串是否包含需要 RTL 和连写排版的字符（阿拉伯语等） */
const HAS_RTL_OR_JOINING = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** 可换行断点：空格、制表符等 */
const IS_BREAK_CHAR = (ch: string) => ch === ' ' || ch === '\t' || ch === '\u00A0';

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
   * 描边/阴影等特效导致的纹理扩容比例 X/Y
   */
  protected effectScaleX = 1;
  protected effectScaleY = 1;

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

    this.maxLineWidth = 0;
    const width = (this.textLayout.width + this.textStyle.fontOffset);

    // 设置 context.font 的字号，确保 measureText 能正确计算字宽
    if (context) {
      context.font = this.getFontDesc(this.textStyle.fontSize);
    }

    if (overflow === spec.TextOverflow.display) {
      // display 模式仅按 \n 换行
      let lineCount = 1;
      let x = 0;
      const chars = Array.from(text);
      const measureChar = (ch: string) => context?.measureText(ch)?.width ?? 0;
      for (let i = 0; i < chars.length; i++) {
        const str = chars[i];
        if (str === '\n') {
          lineCount++;
          x = 0;
        } else {
          if (i > 0 && chars[i - 1] !== '\n') {
            x += letterSpace;
          }
          x += measureChar(str);
          this.maxLineWidth = Math.max(this.maxLineWidth, x);
        }
      }
      return lineCount;
    }

    const lineInfos = this.computeLineBreaks(
      text,
      width,
      (ch) => context?.measureText(ch)?.width ?? 0,
      letterSpace,
      1,
    );
    if (lineInfos.length > 0) {
      this.maxLineWidth = Math.max(...lineInfos.map((l) => l.width));
    }
    return lineInfos.length;
  }

  /**
   * 按词边界换行，避免在词中间断开（阿拉伯语、中文等）
   * 空格、制表符为可断点；超长单词无断点时回退到按字符断
   */
  private computeLineBreaks (
    text: string,
    baseWidth: number,
    measureChar: (ch: string) => number,
    letterSpace: number,
    fontScale: number,
  ): { chars: string[], charOffsetX: number[], width: number }[] {
    const chars = Array.from(text);
    const result: { chars: string[], charOffsetX: number[], width: number }[] = [];
    let charsArray: string[] = [];
    let charOffsetX: number[] = [];
    let x = 0;

    const pushLine = (lineChars: string[], lineWidth: number, offsets: number[]) => {
      if (lineChars.length > 0) {
        result.push({
          chars: lineChars,
          charOffsetX: offsets,
          width: lineWidth,
        });
      }
    };

    const measureLine = (arr: string[]) => {
      let w = 0;
      const offsets: number[] = [];
      for (let j = 0; j < arr.length; j++) {
        if (j > 0) {
          w += letterSpace * fontScale;
        }
        offsets.push(w);
        w += measureChar(arr[j]);
      }
      return { width: w, offsets };
    };

    for (let i = 0; i < chars.length; i++) {
      const str = chars[i];

      if (str === '\n') {
        pushLine(charsArray, x, charOffsetX);
        charsArray = [];
        charOffsetX = [];
        x = 0;
        continue;
      }

      const charW = measureChar(str);
      const spacing = charsArray.length > 0 ? letterSpace * fontScale : 0;
      const willWidth = x + spacing + charW;

      if (willWidth > baseWidth && charsArray.length > 0) {
        let lastSpaceIdx = -1;
        for (let k = charsArray.length - 1; k >= 0; k--) {
          if (IS_BREAK_CHAR(charsArray[k])) {
            lastSpaceIdx = k;
            break;
          }
        }
        if (lastSpaceIdx >= 0) {
          const line1Chars = charsArray.slice(0, lastSpaceIdx);
          const remainder = charsArray.slice(lastSpaceIdx + 1).concat(str);
          const { width: line1W, offsets: line1Offsets } = measureLine(line1Chars);
          pushLine(line1Chars, line1W, line1Offsets);
          const { width: remW, offsets: remOffsets } = measureLine(remainder);
          charsArray = remainder;
          charOffsetX = remOffsets;
          x = remW;
        } else {
          pushLine(charsArray, x, charOffsetX);
          charsArray = [str];
          charOffsetX = [0];
          x = charW;
        }
      } else {
        if (charsArray.length > 0) {
          x += spacing;
        }
        charOffsetX.push(x);
        charsArray.push(str);
        x += charW;
      }
    }

    if (charsArray.length > 0) {
      pushLine(charsArray, x, charOffsetX);
    }

    return result;
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

    const baseWidth = (layout.width + style.fontOffset) * fontScale;
    const finalHeight = layout.lineHeight * this.lineCount;

    const fontSize = style.fontSize * fontScale;
    const lineHeight = layout.lineHeight * fontScale;

    style.fontDesc = this.getFontDesc(fontSize);

    let baseHeight = 0;

    if (layout.autoWidth) {
      baseHeight = finalHeight * fontScale;
      this.item.transform.size.set(1, finalHeight / layout.height);
    } else {
      baseHeight = layout.height * fontScale;
    }

    const { padL, padR, padT, padB } = this.getEffectPadding();
    const hasEffect = (padL | padR | padT | padB) !== 0;

    const texWidth = hasEffect ? Math.ceil(baseWidth + padL + padR) : baseWidth;
    const texHeight = hasEffect ? Math.ceil(baseHeight + padT + padB) : baseHeight;

    const shiftX = hasEffect ? padL : 0;
    const shiftY = hasEffect ? (flipY ? padT : padB) : 0;

    // 给渲染层用：扩容比例
    this.effectScaleX = baseWidth > 0 ? (texWidth / baseWidth) : 1;
    this.effectScaleY = baseHeight > 0 ? (texHeight / baseHeight) : 1;

    this.renderToTexture(texWidth, texHeight, flipY, context => {
      // canvas size 变化后重新刷新 context
      if (this.maxLineWidth > baseWidth && layout.overflow === spec.TextOverflow.display) {
        context.font = this.getFontDesc(fontSize * baseWidth / this.maxLineWidth);
      } else {
        context.font = style.fontDesc;
      }

      // textColor 统一是 0-1，写入 canvas 时乘 255
      const [r, g, b, a] = style.textColor;

      context.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;

      const lineBreaks = this.computeLineBreaks(
        this.text || '',
        baseWidth,
        (ch) => context.measureText(ch).width,
        layout.letterSpace,
        fontScale,
      );
      let y = layout.getOffsetY(style, this.lineCount, lineHeight, fontSize);
      const charsInfo: CharInfo[] = lineBreaks.map((line) => {
        const info: CharInfo = {
          y,
          chars: line.chars,
          charOffsetX: line.charOffsetX,
          width: line.width,
        };
        y += lineHeight;
        return info;
      });

      const hasOutline = style.isOutlined && style.outlineWidth > 0;

      if (hasOutline) {
        // 有描边：在描边时启用阴影
        if (style.hasShadow) {
          this.setupShadow();
        }
        this.setupOutline();

        charsInfo.forEach(charInfo => {
          this.drawLine(charInfo, context, layout, style, shiftX, shiftY, 'stroke');
        });

        // 描边完成后立即禁用阴影，避免填充时重复绘制阴影
        if (style.hasShadow) {
          context.shadowColor = 'transparent';
        }
      }

      // 填充阶段：无描边时才启用阴影
      if (!hasOutline && style.hasShadow) {
        this.setupShadow();
      }

      charsInfo.forEach(charInfo => {
        this.drawLine(charInfo, context, layout, style, shiftX, shiftY, 'fill');
      });

      // 清理阴影状态
      if (style.hasShadow) {
        context.shadowColor = 'transparent';
      }
    });

    this.isDirty = false;
  }

  /**
   * 绘制单行文本，对阿拉伯语等 RTL/连写脚本按整行绘制以保证正确的字形和方向
   */
  private drawLine (
    charInfo: CharInfo,
    context: CanvasRenderingContext2D,
    layout: TextLayout,
    style: TextStyle,
    shiftX: number,
    shiftY: number,
    mode: 'fill' | 'stroke'
  ): void {
    const ox = layout.getOffsetX(style, charInfo.width);
    const drawY = shiftY + charInfo.y;
    const lineStr = charInfo.chars.join('');

    if (lineStr.length === 0) {
      return;
    }

    const needRtl = HAS_RTL_OR_JOINING.test(lineStr);
    if (needRtl) {
      context.save();
      context.direction = 'rtl';
      // RTL 时 fillText 的 x 为文本右边缘，故用 ox + width
      const drawX = shiftX + ox + charInfo.width;
      if (mode === 'fill') {
        context.fillText(lineStr, drawX, drawY);
      } else {
        context.strokeText(lineStr, drawX, drawY);
      }
      context.restore();
    } else {
      for (let i = 0; i < charInfo.chars.length; i++) {
        const str = charInfo.chars[i];
        const drawX = shiftX + ox + charInfo.charOffsetX[i];
        if (mode === 'fill') {
          context.fillText(str, drawX, drawY);
        } else {
          context.strokeText(str, drawX, drawY);
        }
      }
    }
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
}

applyMixins(TextComponent, [TextComponentBase]);
