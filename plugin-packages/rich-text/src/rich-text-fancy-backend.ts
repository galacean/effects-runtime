import type { FancyRenderLayer, TextStyle } from '@galacean/effects';

export interface TextEffectPadding {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

/** Computes conservative symmetric padding for the current GE fancy layers. */
export function calculateTextEffectPadding (
  textStyle: TextStyle,
  rangeFancyLayers: Record<string, FancyRenderLayer[]> = {},
): TextEffectPadding {
  const outlinePad = textStyle.isOutlined && textStyle.outlineWidth > 0
    ? Math.ceil(textStyle.outlineWidth * 2)
    : 0;
  let shadowPad = textStyle.hasShadow
    ? Math.ceil(Math.abs(textStyle.shadowOffsetX) + Math.abs(textStyle.shadowOffsetY) + textStyle.shadowBlur)
    : 0;
  let glowPad = 0;
  let strokePad = 0;

  const rangeLayers = Object.keys(rangeFancyLayers).reduce<FancyRenderLayer[]>(
    (allLayers, sourceRangeId) => allLayers.concat(rangeFancyLayers[sourceRangeId]),
    [],
  );
  const layers = [
    ...(textStyle.fancyRenderStyle?.layers ?? []),
    ...rangeLayers,
  ];

  for (const layer of layers) {
    if (layer.kind === 'glow') {
      glowPad = Math.max(glowPad, Math.ceil(layer.params.blur * Math.max(1, layer.params.intensity)));
    } else if (layer.kind === 'shadow') {
      shadowPad = Math.max(
        shadowPad,
        Math.ceil(Math.abs(layer.params.offsetX) + Math.abs(layer.params.offsetY) + layer.params.blur),
      );
    } else if (layer.kind === 'single-stroke') {
      strokePad = Math.max(strokePad, Math.ceil(layer.params.width));
    }
  }

  const pad = outlinePad + shadowPad + glowPad + strokePad;

  return { left: pad, right: pad, top: pad, bottom: pad };
}
// 富文本花字的 Canvas 执行实现已统一到 core 的 CanvasTextRenderBackend，
// 插件侧保留类名与 padding 计算作为兼容出口。
export { CanvasTextRenderBackend as CanvasRichTextFancyBackend } from '@galacean/effects';
export type { CanvasTextRenderBackendOptions as CanvasRichTextFancyBackendOptions } from '@galacean/effects';
