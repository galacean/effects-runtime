import type { Engine } from '../../engine';
import type { Material } from '../../material';
import { Texture } from '../../texture';
import type { ItemRenderer } from '../../components';
import type { VFXItem } from '../../vfx-item';
import type { LayoutBase } from './layout-base';
import type { TextStyle } from './text-style';
import * as spec from '@galacean/effects-specification';
import { glContext } from '../../gl';
import { isValidFontFamily } from '../../utils';
import { canvasPool } from '../../canvas-pool';

export class TextComponentBase {
  // 状态与通用字段
  textStyle: TextStyle;
  textLayout: LayoutBase;
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

  // 差异化方法 - 由子类实现，不在 Base 中定义

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

  setTextBaseline (value: spec.TextBaseline): void {
    if (this.textLayout.textBaseline === value) {
      return;
    }
    this.textLayout.textBaseline = value;
    this.isDirty = true;
  }

  setTextColor (value: spec.RGBAColorValue): void {
    if (this.textStyle.textColor === value) {
      return;
    }
    this.textStyle.textColor = value;
    this.isDirty = true;
  }

  setFontFamily (value: string): void {
    if (this.textStyle.fontFamily === value && !isValidFontFamily(value)) {
      console.warn('The font is either the current font or a risky font family.');

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

    // ✅ 先保存状态
    context.save();

    // 设置canvas尺寸
    this.canvas.width = width;
    this.canvas.height = height;

    // ✅ 重置变换
    context.setTransform(1, 0, 0, 1, 0, 0);

    // 处理翻转
    if (!flipY) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    // 在翻转后清空（与原版路径一致）
    context.clearRect(0, 0, width, height);

    // 执行绘制回调前可选设置 alpha 修复的填充色（不绘制像素，保持与原版一致）
    context.fillStyle = `rgba(255, 255, 255, ${this.ALPHA_FIX_VALUE})`;

    // 执行绘制回调
    drawCallback(context);

    // ✅ 创建纹理前恢复状态
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
