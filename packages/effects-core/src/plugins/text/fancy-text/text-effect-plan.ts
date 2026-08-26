import {
  isObjectFancyLayer,
  type FancyRenderLayer,
  type LayerCategory,
  type TexturePatternConfig,
} from './fancy-types';

/** Backend-neutral texture layer. Runtime CanvasPattern stays in the adapter. */
export interface TextTextureLayer {
  kind: 'texture',
  category?: LayerCategory,
  params: { pattern: TexturePatternConfig, opacity?: number },
}

export type TextEffectLayer =
  | Exclude<FancyRenderLayer, { kind: 'texture' }>
  | TextTextureLayer;

export type TextEffectSource = 'glyph' | 'fill-and-stroke-mask' | 'object-fill-mask';
export type TextEffectComposite = 'content' | 'behind-content' | 'mask-out';
export type TextEffectIsolation = 'range' | 'object';

export interface TextEffectLayerPlan {
  layerId: string,
  order: number,
  stage: 'range' | 'object',
  source: TextEffectSource,
  composite: TextEffectComposite,
  isolation: TextEffectIsolation,
  layer: TextEffectLayer,
  /** Adapter-resolved resource key, for example a texture image/repeat key. */
  resourceId?: string,
}

export interface TextEffectPlan {
  defaultRangeLayers: TextEffectLayerPlan[],
  rangeLayersBySourceId: Record<string, TextEffectLayerPlan[]>,
  objectLayers: TextEffectLayerPlan[],
}

export function getTextTextureResourceId (layer: FancyRenderLayer | TextEffectLayer): string | undefined {
  if (layer.kind !== 'texture') {
    return undefined;
  }

  const pattern = layer.params.pattern;

  return `${pattern.imageUrl}|${pattern.repeat ?? 'repeat'}`;
}

function resolveEffectSemantics (
  layer: FancyRenderLayer,
  stage: 'range' | 'object',
): Pick<TextEffectLayerPlan, 'source' | 'composite' | 'isolation'> {
  switch (layer.kind) {
    case 'shadow':
      return { source: 'fill-and-stroke-mask', composite: 'behind-content', isolation: 'range' };
    case 'glow':
      return { source: 'object-fill-mask', composite: 'behind-content', isolation: 'object' };
    default:
      return { source: 'glyph', composite: 'content', isolation: stage };
  }
}

function normalizeLayer (layer: FancyRenderLayer): TextEffectLayer {
  if (layer.kind === 'texture') {
    return { kind: 'texture', category: layer.category, params: layer.params };
  }

  return layer;
}

export function compileTextEffectLayers (
  layers: FancyRenderLayer[],
  layerIdPrefix = 'layer',
): { rangeLayers: TextEffectLayerPlan[], objectLayers: TextEffectLayerPlan[] } {
  const rangeLayers: TextEffectLayerPlan[] = [];
  const objectLayers: TextEffectLayerPlan[] = [];

  layers.forEach((layer, order) => {
    const stage = isObjectFancyLayer(layer) ? 'object' : 'range';
    const plan: TextEffectLayerPlan = {
      layerId: `${layerIdPrefix}-${order}`,
      order,
      stage,
      ...resolveEffectSemantics(layer, stage),
      layer: normalizeLayer(layer),
      resourceId: getTextTextureResourceId(layer),
    };

    if (plan.stage === 'object') {
      objectLayers.push(plan);
    } else {
      rangeLayers.push(plan);
    }
  });

  return { rangeLayers, objectLayers };
}

export interface TextEffectPlanBuildOptions {
  defaultLayers: FancyRenderLayer[],
  rangeLayersBySourceId?: Record<string, FancyRenderLayer[]>,
}

/**
 * Compiles FancyConfig layers into a backend-neutral effect plan.
 *
 * Semantics of `rangeLayersBySourceId`:
 * - Key present with non-empty array → that range uses the provided layers (replace).
 * - Key present with empty array → that range has NO effect layers (disable / transparent).
 * - Key absent → that range inherits `defaultRangeLayers`.
 */
export function compileTextEffectPlan (options: TextEffectPlanBuildOptions): TextEffectPlan {
  const defaultLayers = compileTextEffectLayers(options.defaultLayers);
  const rangeLayersBySourceId: Record<string, TextEffectLayerPlan[]> = {};

  for (const sourceRangeId of Object.keys(options.rangeLayersBySourceId ?? {})) {
    rangeLayersBySourceId[sourceRangeId] = compileTextEffectLayers(
      options.rangeLayersBySourceId?.[sourceRangeId] ?? [],
      `range-${sourceRangeId}`,
    ).rangeLayers;
  }

  return {
    defaultRangeLayers: defaultLayers.rangeLayers,
    rangeLayersBySourceId,
    objectLayers: defaultLayers.objectLayers,
  };
}
