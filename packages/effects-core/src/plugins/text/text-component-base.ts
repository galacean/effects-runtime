import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import type { Material } from '../../material';
import { Texture } from '../../texture';
import type { ItemRenderer } from '../../components';
import type { VFXItem } from '../../vfx-item';
import type { BaseLayout } from './base-layout';
import type { TextStyle } from './text-style';
import { glContext } from '../../gl';
import { isValidFontFamily } from '../../utils';
import { canvasPool } from '../../canvas-pool';

/**
 * 纯文本组件特有 API
 */
export interface ITextComponent {
  setOutlineWidth (value: number): void,
  setOutlineEnabled (value: boolean): void,
  setShadowBlur (value: number): void,
  setShadowColor (value: spec.RGBAColorValue): void,
  setShadowOffsetX (value: number): void,
  setShadowOffsetY (value: number): void,
  setAutoWidth (value: boolean): void,
  setFontSize (value: number): void,
}

/**
 * 富文本组件特有 API
 */
export interface IRichTextComponent extends ITextComponent { }

/**
 * 排版逻辑尺寸接口
 */
export interface LayoutBoundsSize {
  /** 宽度 */
  width: number,
  /** 高度 */
  height: number,
}

export class TextComponentBase {
  // 状态与通用字段
  textStyle: TextStyle;
  textLayout: BaseLayout;
  text: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;

  // 通用状态字段
  isDirty = true;
  engine: Engine;
  material: Material;
  item: VFXItem;
  renderer: ItemRenderer;
  lineCount = 0;

  protected maxLineWidth = 0;
  // 常量
  protected readonly SCALE_FACTOR = 0.1;
  protected readonly ALPHA_FIX_VALUE = 1 / 255;

  /**
   * 排版逻辑尺寸
   * 单位与 textWidth/textHeight 一致
   * @returns 排版逻辑尺寸
   */
  public getLayoutBoundsSize (): LayoutBoundsSize {
    const style = this.textStyle;
    const layout = this.textLayout as any;

    const width = (layout.width + style.fontOffset);
    const height = layout.autoWidth
      ? (layout.lineHeight * this.lineCount)
      : layout.height;

    return {
      width: width,
      height: height,
    };
  }

  // 通用 setter 方法
  setText (value: string): void {
    if (this.text === value) {
      return;
    }
    this.text = value.toString();
    this.isDirty = true;
  }

  setTextAlign (value: spec.TextAlignment): void {
    if (this.textLayout.textAlign === value) {
      return;
    }
    this.textLayout.textAlign = value;
    this.isDirty = true;
  }

  setTextVerticalAlign (value: spec.TextVerticalAlign): void {
    if (this.textLayout.textVerticalAlign === (value as unknown as spec.TextVerticalAlign)) {
      return;
    }
    this.textLayout.textVerticalAlign = value as unknown as spec.TextVerticalAlign;
    this.isDirty = true;
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

  setTextColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.textColor === value) {
      return;
    }
    this.textStyle.textColor = value;
    this.isDirty = true;
  }

  setFontFamily (value: string): void {
    if (!isValidFontFamily(value)) {
      console.warn('Risky font family, ignored:', value);

      return;
    }
    if (this.textStyle.fontFamily === value) {
      return;
    }
    this.textStyle.fontFamily = value;
    this.isDirty = true;
  }

  setFontWeight (value: spec.TextWeight): void {
    if (this.textStyle.textWeight === value) {
      return;
    }
    this.textStyle.textWeight = value;
    this.isDirty = true;
  }

  setFontStyle (value: spec.FontStyle): void {
    if (this.textStyle.fontStyle === value) {
      return;
    }
    this.textStyle.fontStyle = value;
    this.isDirty = true;
  }

  setOutlineColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.outlineColor === value) {
      return;
    }
    this.textStyle.outlineColor = value;
    this.isDirty = true;
  }

  setOutlineEnabled (value: boolean): void {
    if (this.textStyle.isOutlined === value) {
      return;
    }
    this.textStyle.isOutlined = value;
    this.isDirty = true;
  }

  setFontScale (value: number): void {
    if (this.textStyle.fontScale === value) {
      return;
    }
    this.textStyle.fontScale = value;
    this.isDirty = true;
  }

  setOverflow (overflow: spec.TextOverflow): void {
    this.textLayout.overflow = overflow;
    this.isDirty = true;
  }

  /**
   * 获取描边和阴影的 padding 值
   * @returns { padL: number; padR: number; padT: number; padB: number } padding 值
   */
  protected getEffectPaddingPx () {
    const s = this.textStyle;

    const hasDrawOutline = s.isOutlined && s.outlineWidth > 0;
    const outlinePad = hasDrawOutline ? Math.ceil(s.outlineWidth * 2 * s.fontScale) : 0;

    const hasShadow = s.hasShadow && (s.shadowBlur > 0 || s.shadowOffsetX !== 0 || s.shadowOffsetY !== 0);
    const shadowPad = hasShadow
      ? Math.ceil((Math.abs(s.shadowOffsetX) + Math.abs(s.shadowOffsetY) + s.shadowBlur) * s.fontScale)
      : 0;

    const pad = outlinePad + shadowPad;

    return { padL: pad, padR: pad, padT: pad, padB: pad };
  }

  // 通用工具方法
  protected getFontDesc (size?: number): string {
    const { fontSize, fontScale, fontFamily, textWeight, fontStyle } = this.textStyle;
    let fontDesc = `${(size || fontSize * fontScale).toString()}px `;

    if (!['serif', 'sans-serif', 'monospace', 'courier'].includes(fontFamily)) {
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

  protected setupOutline (): void {
    const context = this.context;
    const { outlineColor, outlineWidth } = this.textStyle;
    const [r, g, b, a] = outlineColor;

    if (context) {
      context.strokeStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      context.lineWidth = outlineWidth * 2;
    }
  }

  protected setupShadow (): void {
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

  // 通用纹理生命周期管理
  protected disposeTextTexture (): void {
    const texture = this.renderer.texture;

    if (texture && texture !== this.engine.whiteTexture) {
      texture.dispose();
    }
  }

  /**
   * 通用纹理渲染辅助方法
   */
  protected renderToTexture (
    width: number,
    height: number,
    flipY: boolean,
    drawCallback: (ctx: CanvasRenderingContext2D) => void,
    options: { disposeOld?: boolean } = {}
  ): void {
    if (!this.context || !this.canvas) {
      return;
    }

    const context = this.context;

    // 先保存状态
    context.save();

    // 设置canvas尺寸
    this.canvas.width = width;
    this.canvas.height = height;

    //重置变换
    context.setTransform(1, 0, 0, 1, 0, 0);

    // 处理翻转
    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    // 在翻转后清空画布
    context.clearRect(0, 0, width, height);

    // 设置 alpha 修复用填充色（不实际输出像素）
    context.fillStyle = `rgba(255, 255, 255, ${this.ALPHA_FIX_VALUE})`;

    // 执行绘制回调
    drawCallback(context);

    // 创建纹理前恢复状态
    context.restore();

    // 创建新纹理
    const imageData = context.getImageData(0, 0, width, height);
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

    // 根据选项决定是否释放旧纹理
    if (options.disposeOld !== false) {
      this.disposeTextTexture();
    }
    this.renderer.texture = texture;
    this.material.setTexture('_MainTex', texture);
  }

  // 初始化方法，由子类调用
  protected initTextBase (engine: Engine): void {
    this.engine = engine;
    this.canvas = canvasPool.getCanvas();
    canvasPool.saveCanvas(this.canvas);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }
}
