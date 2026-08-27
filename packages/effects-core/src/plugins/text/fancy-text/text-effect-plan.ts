import type { FancyRenderLayer, LayerCategory, TexturePatternConfig } from './fancy-types';

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
/** `mask-out` is reserved for a future negative-mask pass. */
export type TextEffectComposite = 'content' | 'behind-content' | 'mask-out';
export type TextEffectIsolation = 'range' | 'object';

export interface TextEffectLayerPlan {
  layerId: string,
  order: number,
  /** The mask/content source selected by the backend, not inferred from kind. */
  source: TextEffectSource,
  /** How the result is composited; non-content effects may require isolation. */
  composite: TextEffectComposite,
  /** The range/object scope used to select source glyphs. */
  isolation: TextEffectIsolation,
  layer: TextEffectLayer,
  /** Adapter-resolved resource key, for example a texture image/repeat key. */
  resourceId?: string,
}

/**
 * 花字层的执行能力。
 *
 * 这张表是效果 kind 到执行语义的唯一来源；普通文本、RichText 和后端
 * 不需要各自维护一份 Object/Range 判断。
 */
export interface FancyLayerCapability {
  source: TextEffectSource,
  composite: TextEffectComposite,
  isolation: TextEffectIsolation,
}

export const FANCY_LAYER_CAPABILITIES = {
  shadow: {
    source: 'fill-and-stroke-mask',
    composite: 'behind-content',
    isolation: 'range',
  },
  glow: {
    source: 'object-fill-mask',
    composite: 'behind-content',
    isolation: 'object',
  },
  'single-stroke': {
    source: 'glyph',
    composite: 'content',
    isolation: 'range',
  },
  'solid-fill': {
    source: 'glyph',
    composite: 'content',
    isolation: 'range',
  },
  gradient: {
    source: 'glyph',
    composite: 'content',
    isolation: 'object',
  },
  texture: {
    source: 'glyph',
    composite: 'content',
    isolation: 'object',
  },
} satisfies Record<FancyRenderLayer['kind'], FancyLayerCapability>;

/** 根据能力表读取一个花字层的执行语义。 */
export function getFancyLayerCapability (layer: FancyRenderLayer): FancyLayerCapability {
  return FANCY_LAYER_CAPABILITIES[layer.kind];
}

/** 根据能力表判断当前层是否按 Object 作用域执行。 */
export function isObjectFancyLayer (layer: FancyRenderLayer): boolean {
  return getFancyLayerCapability(layer).isolation === 'object';
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
    const plan: TextEffectLayerPlan = {
      layerId: `${layerIdPrefix}-${order}`,
      order,
      ...getFancyLayerCapability(layer),
      layer: normalizeLayer(layer),
      resourceId: getTextTextureResourceId(layer),
    };

    if (plan.isolation === 'object') {
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
