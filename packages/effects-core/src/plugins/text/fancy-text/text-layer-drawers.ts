import type { TextEnv, TextLayerDrawer } from './fancy-types';

const ANTIALIAS_PADDING = 1;

/** 逐字符填充 + 抗锯齿补偿 */
function fillTextWithPadding (ctx: CanvasRenderingContext2D, env: TextEnv): void {
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

/** 外描边绘制器：通过离屏 canvas 实现仅保留文字外侧描边 */
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

    if (!offCtx) { return; }

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

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];
        offCtx.strokeText(ch, x, line.y);
      });
    });

    // 擦除文字内部
    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.fillStyle = 'white';

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];
        offCtx.fillText(ch, x, line.y);
      });
    });

    // 合成到主 canvas
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

    const gradient = ctx.createLinearGradient(
      cx - halfLen * Math.cos(angleRad),
      cy - halfLen * Math.sin(angleRad),
      cx + halfLen * Math.cos(angleRad),
      cy + halfLen * Math.sin(angleRad),
    );

    this.colors.forEach((color, index) => {
      const [r, g, b, a] = color;
      const stop = this.colors.length === 1 ? 0 : index / (this.colors.length - 1);
      gradient.addColorStop(stop, `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`);
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

  /** 获取阴影参数 */
  getShadowParams (): { color: string, blur: number, offsetX: number, offsetY: number } {
    const [r, g, b, a] = this.color;

    return {
      color: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`,
      blur: this.blur,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    // 阴影渲染在 renderWithTextLayers 中统一处理
  }
}

/** 纹理填充绘制器 */
export class TextureDrawer implements TextLayerDrawer {
  name = 'texture';

  constructor (
    private pattern: CanvasPattern | null,
    private opacity: number = 1,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    if (!this.pattern) { return; }

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.pattern;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * this.opacity;
    fillTextWithPadding(ctx, env);
    ctx.globalAlpha = prevAlpha;
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
    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    fillTextWithPadding(ctx, env);
  }
}
