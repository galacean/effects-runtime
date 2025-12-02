import type { TextEffect } from './fancy-types';

export interface CharInfo {
  y: number,
  width: number,
  chars: string[],
  charOffsetX: number[],
}

function createTextEnv (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  style: any,
  layout: any,
  charsInfo: CharInfo[]
) {
  return {
    fontDesc: style.fontDesc,
    style,
    layout,
    lines: charsInfo,
    layer: {
      dispose: () => {
        // 释放资源的逻辑
      },
    },
    canvas,
  };
}

export function renderWithEffects (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  style: any,
  layout: any,
  charsInfo: CharInfo[],
  effects: TextEffect[]
) {
  const env = createTextEnv(canvas, context, style, layout, charsInfo);
  const effs = effects || [];

  context.save();
  for (const eff of effs) {
    if (typeof eff.render === 'function') {
      eff.render(context, env);
    } else {
      eff.renderDecorations?.(context, env);
      eff.renderFill?.(context, env);
    }
  }
  context.restore();

  env.layer.dispose();
}
