import type { TextEffect, TextEnv } from './fancy-types';

export class SimpleStrokeEffect implements TextEffect {
  name = 'simple-stroke';

  constructor (
    private width: number,
    private color: [number, number, number, number],
    private unit: 'px' | 'em' = 'px',
  ) {}

  render (ctx: CanvasRenderingContext2D, env: TextEnv): void {
    ctx.font = env.fontDesc;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    // 清掉影子，由 SimpleShadowEffect 负责
    // 注意：如果希望阴影作用于描边，SimpleShadowEffect 要在 stroke 之前执行，并且 renderWithEffects 不能 save/restore 每个 effect
    // 这里不重置 shadow

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

export class SimpleShadowEffect implements TextEffect {
  name = 'simple-shadow';

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
    // 如果新系统原来是 ctx.shadowOffsetY = -shadowOffsetY，则这里也保持一致
    ctx.shadowOffsetY = -this.offsetY;
  }
}
