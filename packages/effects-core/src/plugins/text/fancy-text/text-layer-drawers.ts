import type { TextEnv, TextLayerDrawer } from './fancy-types';

/** 抗锯齿补偿宽度（px），用于 fill 层向外扩展以消除与 stroke 之间的缝隙 */
const ANTIALIAS_PADDING = 1;

/**
 * 逐字符 fillText + 微小 strokeText，补偿抗锯齿边缘
 */
function fillTextWithPadding (
  ctx: CanvasRenderingContext2D,
  env: TextEnv,
): void {
  ctx.save();
  ctx.lineWidth = ANTIALIAS_PADDING;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle;

  env.lines.forEach(line => {
    const baseX = env.layout.getOffsetX(env.style, line.width);

    line.chars.forEach((ch: string, i: number) => {
      const x = baseX + line.charOffsetX[i];

      ctx.fillText(ch, x, line.y);
      ctx.strokeText(ch, x, line.y);
    });
  });

  ctx.restore();
}

/**
 * 外描边绘制器：通过离屏 canvas 实现仅保留文字外侧描边
 */
export class SingleStrokeDrawer implements TextLayerDrawer {
  name = 'single-stroke';

  constructor (
    private width: number,
    private color: [number, number, number, number],
    private unit: 'px' | 'em' = 'px',
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    const { canvas } = env;
    const offscreen = document.createElement('canvas');

    offscreen.width = canvas.width;
    offscreen.height = canvas.height;

    const offCtx = offscreen.getContext('2d');

    if (!offCtx) {
      return;
    }

    // 同步主 canvas 变换矩阵，保证渲染精度一致
    offCtx.setTransform(ctx.getTransform());

    const fontScale = env.style.fontScale || 1;
    const widthPx = this.unit === 'em'
      ? this.width * env.style.fontSize * fontScale
      : this.width * fontScale;

    const [r, g, b, a] = this.color;
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);

    offCtx.font = env.fontDesc;
    offCtx.textBaseline = 'alphabetic';
    offCtx.lineJoin = 'round';
    offCtx.lineWidth = widthPx;
    offCtx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${a})`;

    // 绘制完整描边
    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        offCtx.strokeText(ch, x, line.y);
      });
    });

    // destination-out 擦除文字内部
    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.fillStyle = 'white';

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        offCtx.fillText(ch, x, line.y);
      });
    });

    // 重置变换后按像素 1:1 合成到主 canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  }
}

/** 渐变填充绘制器 */
export class GradientDrawer implements TextLayerDrawer {
  name = 'gradient';

  constructor (
    private colors: [number, number, number, number][],
    private angle: number = 0,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';

    const { canvas } = env;
    const angleRad = (this.angle * Math.PI) / 180;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const halfLen = Math.sqrt(cx * cx + cy * cy);

    const x0 = cx - halfLen * Math.cos(angleRad);
    const y0 = cy - halfLen * Math.sin(angleRad);
    const x1 = cx + halfLen * Math.cos(angleRad);
    const y1 = cy + halfLen * Math.sin(angleRad);

    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    this.colors.forEach((color, index) => {
      const [r, g, b, a] = color;
      const R = Math.round(r * 255);
      const G = Math.round(g * 255);
      const B = Math.round(b * 255);
      const stop = this.colors.length === 1 ? 0 : index / (this.colors.length - 1);

      gradient.addColorStop(stop, `rgba(${R}, ${G}, ${B}, ${a})`);
    });

    ctx.fillStyle = gradient;

    fillTextWithPadding(ctx, env);
  }
}

/** 阴影绘制器 */
export class ShadowDrawer implements TextLayerDrawer {
  name = 'shadow';

  constructor (
    private color: [number, number, number, number],
    private blur: number,
    private offsetX: number,
    private offsetY: number,
  ) {}

  /**
   * 获取阴影参数（供 renderWithTextLayers 使用）
   */
  getShadowParams (): { color: string, blur: number, offsetX: number, offsetY: number } {
    const [r, g, b, a] = this.color;
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);

    return {
      color: `rgba(${R}, ${G}, ${B}, ${a})`,
      blur: this.blur,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 阴影渲染已移至 renderWithTextLayers 中统一处理
    // 此方法保留为空，不再直接设置 ctx.shadow* 状态
    // 避免阴影状态泄漏到后续的 fill/stroke drawer
  }
}

/** 纹理填充绘制器 */
export class TextureDrawer implements TextLayerDrawer {
  name = 'texture';

  constructor (
    private pattern: CanvasPattern | null,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    if (!this.pattern) {return;}

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.pattern;

    fillTextWithPadding(ctx, env);
  }
}

/** 纯色填充绘制器 */
export class SolidFillDrawer implements TextLayerDrawer {
  name = 'solid-fill';

  constructor (
    private color: [number, number, number, number],
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';

    const [r, g, b, a] = this.color;
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);

    ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${a})`;

    fillTextWithPadding(ctx, env);
  }
}
