import type { TextEffect, TextEnv } from './fancy-types';

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
