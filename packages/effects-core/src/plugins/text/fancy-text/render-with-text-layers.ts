import type { TextLayerDrawer } from './fancy-types';

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
  charsInfo: CharInfo[],
) {
  return {
    fontDesc: style.fontDesc,
    style,
    layout,
    lines: charsInfo,
    layer: {
      dispose: () => {},
    },
    canvas,
  };
}

/** 按顺序执行一组 TextLayerDrawer 绘制文本 */
export function renderWithTextLayers (
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  style: any,
  layout: any,
  charsInfo: CharInfo[],
  layerDrawers: TextLayerDrawer[],
) {
  const env = createTextEnv(canvas, context, style, layout, charsInfo);
  const drawers = layerDrawers || [];

  context.save();
  for (const drawer of drawers) {
    if (typeof drawer.render === 'function') {
      drawer.render(context, env);
    } else {
      drawer.renderDecorations?.(context, env);
      drawer.renderFill?.(context, env);
    }
  }
  context.restore();

  env.layer.dispose();
}
