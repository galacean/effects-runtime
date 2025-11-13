import { Color } from '@galacean/effects-math/es/core/index';
import * as spec from '@galacean/effects-specification';
import { MaskableGraphic } from '../../components';
import { effectsClass } from '../../decorators';
import type { Engine } from '../../engine';
import { applyMixins } from '../../utils';
import type { LayoutBase } from './layout-base';
import { TextLayout } from './text-layout';
import { TextStyle } from './text-style';
import { TextComponentBase, type TextRuntimeAPI } from './text-component-base';

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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TextComponent extends TextComponentBase { }

let seed = 0;

/**
 * @since 2.0.0
 */
@effectsClass(spec.DataType.TextComponent)
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TextComponent extends MaskableGraphic implements TextRuntimeAPI {
  isDirty = true;
  /**
   * 文本行数
   */
  lineCount = 0;
  textStyle: TextStyle;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  textLayout: LayoutBase;
  text: string;

  /**
   * 每一行文本的最大宽度
   */
  protected maxLineWidth = 0;

  constructor (engine: Engine, props?: spec.TextComponentData) {
    super(engine);

    this.name = 'MText' + seed++;

    // 初始化通用文本渲染环境
    this.initTextBase(engine);

    if (props) {
      this.fromData(props);
    }
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

    this.updateWithOptions(options);
    this.renderText(options);

    // 恢复默认颜色
    this.material.setColor('_Color', new Color(1, 1, 1, 1));
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

  updateWithOptions (options: spec.TextContentOptions | spec.RichTextContentOptions) {
    const textOptions = options as spec.TextContentOptions;

    this.textStyle = new TextStyle(textOptions);
    this.textLayout = new TextLayout(textOptions);
    this.text = textOptions.text.toString();
    this.lineCount = this.getLineCount(this.text);
    this.isDirty = true;
  }

  getLineCount (text: string): number {
    const context = this.context;
    const { letterSpace, overflow } = this.textLayout;

    // const fontScale = init ? this.textStyle.fontSize / 10 : 1 / this.textStyle.fontScale;
    this.maxLineWidth = 0;
    const width = (this.textLayout.width + this.textStyle.fontOffset);
    let lineCount = 1;
    let x = 0;

    // 设置context.font的字号，确保measureText能正确计算字宽
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

  updateTexture (flipY = true) {
    if (!this.isDirty || !this.context || !this.canvas) {
      return;
    }

    const style = this.textStyle;
    const layout = this.textLayout as TextLayout;
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

      // 文本颜色 - 直接使用vec4原值，不乘以255
      const [r, g, b, a] = style.textColor;

      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;

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
    const layout = this.textLayout as TextLayout;
    const normalizedValue = !!value;

    if (layout.autoWidth === normalizedValue) {
      return;
    }
    layout.autoWidth = normalizedValue;
    this.isDirty = true;
  }

  setFontSize (value: number): void {
    if (this.textStyle.fontSize === value) {
      return;
    }
    // 保证字号变化后位置正常
    const diff = this.textStyle.fontSize - value;
    const layout = this.textLayout as TextLayout;

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

  //setupShadow 使用 outlineColor 作为阴影颜色，更新 shadowColor 不影响阴影颜色
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
