import type { TextLayerDrawer } from './fancy-types';
import { ShadowDrawer } from './text-layer-drawers';

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
 * 在离屏 canvas 上执行非阴影 drawer 的渲染
 */
function renderNonShadowDrawers (
  offCtx: CanvasRenderingContext2D,
  env: any,
  drawers: TextLayerDrawer[],
): void {
  for (const drawer of drawers) {
    if (drawer instanceof ShadowDrawer) {
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

  // 收集所有 ShadowDrawer
  const shadowDrawers = drawers.filter(
    (d): d is ShadowDrawer => d instanceof ShadowDrawer
  );

  // 没有阴影时，直接按顺序渲染所有 drawer（跳过 ShadowDrawer）
  if (shadowDrawers.length === 0) {
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

  // 有阴影时，使用离屏 canvas 实现统一阴影渲染
  // 步骤：
  // 1. 在离屏 canvas 上渲染所有可见的 stroke 和 fill（不含阴影）
  // 2. 将离屏 canvas 的内容带阴影参数绘制到主 canvas（产生统一阴影）
  // 3. 再将离屏 canvas 的内容叠加到主 canvas 上（覆盖在阴影之上）

  const offscreen = document.createElement('canvas');

  offscreen.width = canvas.width;
  offscreen.height = canvas.height;

  const offCtx = offscreen.getContext('2d');

  if (!offCtx) {
    // 降级：直接在主 canvas 上渲染（无阴影）
    context.save();
    renderNonShadowDrawers(context, env, drawers);
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
  renderNonShadowDrawers(offCtx, offEnv, drawers);
  offCtx.restore();

  context.save();

  // 2. 将离屏结果带阴影绘制到主 canvas（产生统一阴影在最底层）
  // 使用最后一个 ShadowDrawer 的参数（多个阴影时取最后一个）
  const shadowParams = shadowDrawers[shadowDrawers.length - 1].getShadowParams();

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.shadowColor = shadowParams.color;
  context.shadowBlur = shadowParams.blur;
  context.shadowOffsetX = shadowParams.offsetX;
  context.shadowOffsetY = shadowParams.offsetY;
  context.drawImage(offscreen, 0, 0);
  context.restore();

  // 3. 多个阴影时，逐个叠加额外的阴影层
  for (let i = 0; i < shadowDrawers.length - 1; i++) {
    const extraShadow = shadowDrawers[i].getShadowParams();

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.shadowColor = extraShadow.color;
    context.shadowBlur = extraShadow.blur;
    context.shadowOffsetX = extraShadow.offsetX;
    context.shadowOffsetY = extraShadow.offsetY;
    // 使用 destination-over 将阴影绘制到已有内容的下方
    context.globalCompositeOperation = 'destination-over';
    context.drawImage(offscreen, 0, 0);
    context.restore();
  }

  context.restore();

  offEnv.layer.dispose();
  env.layer.dispose();
}
