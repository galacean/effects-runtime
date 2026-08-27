import type { FancyRenderLayer, LayerCategory, TexturePatternConfig } from './fancy-types';

/** 后端无关的纹理层；运行时的 CanvasPattern 只保留在 Canvas 适配层。 */
export interface TextTextureLayer {
  kind: 'texture',
  category?: LayerCategory,
  params: { pattern: TexturePatternConfig, opacity?: number },
}

export type TextEffectLayer =
  | Exclude<FancyRenderLayer, { kind: 'texture' }>
  | TextTextureLayer;

export type TextEffectSource = 'glyph' | 'fill-and-stroke-mask' | 'object-fill-mask';
/** `mask-out` 为未来的反向遮罩 Pass 预留。 */
export type TextEffectComposite = 'content' | 'behind-content' | 'mask-out';
export type TextEffectIsolation = 'range' | 'object';

export interface TextEffectLayerPlan {
  layerId: string,
  order: number,
  /** 后端实际使用的遮罩或内容来源，不由后端根据 kind 临时猜测。 */
  source: TextEffectSource,
  /** 当前结果的合成方式；非 content 效果可能需要独立隔离。 */
  composite: TextEffectComposite,
  /** 选择源字形时使用的 Range/Object 作用域。 */
  isolation: TextEffectIsolation,
  layer: TextEffectLayer,
  /** 由适配层解析出的资源 key，例如纹理图片和重复方式组成的 key。 */
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
 * 将 FancyConfig 的层编译为后端无关的效果计划。
 *
 * `rangeLayersBySourceId` 的语义：
 * - 存在且数组非空：该 Range 使用传入的层，并替换默认层；
 * - 存在但数组为空：该 Range 不使用任何效果层，即关闭花字；
 * - 不存在：该 Range 继承 `defaultRangeLayers`。
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
