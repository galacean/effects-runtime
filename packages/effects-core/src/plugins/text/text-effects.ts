import type { TextEffect, TextEnv } from './fancy-types';

/**
 * 单层描边效果
 */
export class SingleStrokeEffect implements TextEffect {
  name = 'single-stroke';

  constructor (
    private width: number,
    private color: [number, number, number, number],
    private unit: 'px' | 'em' = 'px',
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    const fontScale = env.style.fontScale || 1;
    const widthPx = this.unit === 'em'
      ? this.width * env.style.fontSize * fontScale
      : this.width * fontScale;

    ctx.lineWidth = widthPx;

    const [r, g, b, a] = this.color;
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);

    ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${a})`;

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        ctx.strokeText(ch, x, line.y);
      });
    });
  }
}

/**
 * 渐变效果
 */
export class GradientEffect implements TextEffect {
  name = 'gradient';

  constructor (
    private colors: [number, number, number, number][],
    private angle: number = 0,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';

    // 创建渐变
    const canvas = env.layer as any;
    const angleRad = (this.angle * Math.PI) / 180;
    const x0 = 0;
    const y0 = 0;
    const x1 = canvas.width * Math.cos(angleRad);
    const y1 = canvas.height * Math.sin(angleRad);

    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    this.colors.forEach((color, index) => {
      const [r, g, b, a] = color;
      const R = Math.round(r * 255);
      const G = Math.round(g * 255);
      const B = Math.round(b * 255);
      const stop = index / (this.colors.length - 1);

      gradient.addColorStop(stop, `rgba(${R}, ${G}, ${B}, ${a})`);
    });

    ctx.fillStyle = gradient;

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        ctx.fillText(ch, x, line.y);
      });
    });
  }
}

/**
 * 阴影效果
 */
export class ShadowEffect implements TextEffect {
  name = 'shadow';

  constructor (
    private color: [number, number, number, number],
    private blur: number,
    private offsetX: number,
    private offsetY: number,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    const [r, g, b, a] = this.color;
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);

    ctx.shadowColor = `rgba(${R}, ${G}, ${B}, ${a})`;
    ctx.shadowBlur = this.blur;
    ctx.shadowOffsetX = this.offsetX;
    ctx.shadowOffsetY = this.offsetY;
  }
}

/**
 * 纹理效果
 */
export class TextureEffect implements TextEffect {
  name = 'texture';

  constructor (
    private pattern: CanvasPattern | null,
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    if (!this.pattern) {
      return;
    }

    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.pattern;

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        ctx.fillText(ch, x, line.y);
      });
    });
  }
}

/**
 * 纯色填充效果
 */
export class SolidFillEffect implements TextEffect {
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

    env.lines.forEach(line => {
      const baseX = env.layout.getOffsetX(env.style, line.width);

      line.chars.forEach((ch: string, i: number) => {
        const x = baseX + line.charOffsetX[i];

        ctx.fillText(ch, x, line.y);
      });
    });
  }
}
