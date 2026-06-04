import type { TextLayerDrawer } from './fancy-types';
import { GlowDrawer, ShadowDrawer } from './text-layer-drawers';

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

/**
 * 在离屏 canvas 上执行非装饰层 drawer 的渲染（跳过 Shadow 和 Glow）
 */
function renderNonDecorativeDrawers (
  offCtx: CanvasRenderingContext2D,
  env: any,
  drawers: TextLayerDrawer[],
): void {
  for (const drawer of drawers) {
    if (drawer instanceof ShadowDrawer || drawer instanceof GlowDrawer) {
      continue;
    }
    if (typeof drawer.render === 'function') {
      drawer.render(offCtx, env);
    } else {
      drawer.renderDecorations?.(offCtx, env);
      drawer.renderFill?.(offCtx, env);
    }
  }
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

  // 收集所有 ShadowDrawer 和 GlowDrawer
  const shadowDrawers = drawers.filter(
    (d): d is ShadowDrawer => d instanceof ShadowDrawer
  );
  const glowDrawers = drawers.filter(
    (d): d is GlowDrawer => d instanceof GlowDrawer
  );

  // 没有阴影和发光时，直接按顺序渲染所有 drawer
  if (shadowDrawers.length === 0 && glowDrawers.length === 0) {
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

    return;
  }

  // 有阴影或发光时，使用离屏 canvas 实现统一渲染
  // 渲染层次：文字内容 > Glow > Shadow

  const offscreen = document.createElement('canvas');

  offscreen.width = canvas.width;
  offscreen.height = canvas.height;

  const offCtx = offscreen.getContext('2d');

  if (!offCtx) {
    // 降级：直接在主 canvas 上渲染（无阴影/发光）
    context.save();
    renderNonDecorativeDrawers(context, env, drawers);
    context.restore();
    env.layer.dispose();

    return;
  }

  // 同步主 canvas 变换矩阵
  offCtx.setTransform(context.getTransform());

  // 创建离屏环境
  const offEnv = createTextEnv(offscreen, offCtx, style, layout, charsInfo);

  // 1. 在离屏 canvas 上渲染所有可见层（stroke + fill）
  offCtx.save();
  renderNonDecorativeDrawers(offCtx, offEnv, drawers);
  offCtx.restore();

  context.save();

  // 2. 将离屏结果绘制到主 canvas（文字内容本身，最上层）
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(offscreen, 0, 0);
  context.restore();

  // 3. 渲染 Glow 层（在文字内容下方，Shadow 上方）
  for (const glowDrawer of glowDrawers) {
    const glowParams = glowDrawer.getGlowParams();

    for (let i = 0; i < glowParams.intensity; i++) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.shadowColor = glowParams.color;
      context.shadowBlur = glowParams.blur;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      context.globalCompositeOperation = 'destination-over';
      context.drawImage(offscreen, 0, 0);
      context.restore();
    }
  }

  // 4. 渲染 Shadow 层（最底层）
  for (const shadowDrawer of shadowDrawers) {
    const shadowParams = shadowDrawer.getShadowParams();

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.shadowColor = shadowParams.color;
    context.shadowBlur = shadowParams.blur;
    context.shadowOffsetX = shadowParams.offsetX;
    context.shadowOffsetY = shadowParams.offsetY;
    context.globalCompositeOperation = 'destination-over';
    context.drawImage(offscreen, 0, 0);
    context.restore();
  }

  context.restore();

  offEnv.layer.dispose();
  env.layer.dispose();
}
