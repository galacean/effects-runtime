import type * as spec from '@galacean/effects-specification';
import type { FancyRenderLayer } from './fancy-types';

export interface TextLineInput {
  y: number,
  width: number,
  chars: string[],
  charOffsetX: number[],
}

/** A Canvas-independent subset of FancyRenderLayer used by the render plan. */
export type TextRenderLayer =
  | Exclude<FancyRenderLayer, { kind: 'texture' }>
  | Omit<Extract<FancyRenderLayer, { kind: 'texture' }>, 'runtimePattern'>;

export interface TextSize {
  width: number,
  height: number,
}

export interface TextBounds {
  x: number,
  y: number,
  width: number,
  height: number,
}

/**
 * Layout output consumed by text backends.
 *
 * The current Canvas implementation uses a character as the glyph value. The
 * type intentionally names it glyph so that future shaping/MSDF backends do
 * not need to change the plan boundary.
 */
export interface PositionedGlyph {
  id: number,
  glyph: string,
  x: number,
  y: number,
  lineId: number,
  sourceRangeId: string,
  fontRef: string,
  advance?: number,
  bounds?: TextBounds,
  sourceCluster?: number,
}

export interface PositionedTextLine {
  lineId: number,
  baselineY: number,
  width: number,
  originX: number,
  glyphIds: number[],
}

export interface TextRenderLayerPlan {
  layerId: string,
  order: number,
  stage: 'range' | 'object',
  layer: TextRenderLayer,
}

export interface RangeTextStyle {
  fontRef: string,
  fillColor?: spec.vec4,
}

export interface RangePlan {
  sourceRangeId: string,
  glyphIds: number[],
  basicStyle: RangeTextStyle,
  layers: TextRenderLayerPlan[],
}

export interface ObjectPlan {
  layers: TextRenderLayerPlan[],
}

export interface TextGeometry {
  contentBounds?: TextBounds,
  effectBounds?: TextBounds,
  padding: { left: number, right: number, top: number, bottom: number },
  logicalSize: TextSize,
  renderSize: TextSize,
}

export interface TextRenderPlan {
  glyphs: PositionedGlyph[],
  lines: PositionedTextLine[],
  rangePlans: RangePlan[],
  objectPlan: ObjectPlan,
  geometry: TextGeometry,
}

export interface TextRenderPlanBuildOptions {
  fontRef: string,
  sourceRangeId?: string,
  baseXPerLine?: number[],
  contentBounds?: TextBounds,
  logicalSize?: TextSize,
  renderSize?: TextSize,
  padding?: Partial<TextGeometry['padding']>,
  layerIdPrefix?: string,
}

export interface TextRenderBackend<TTarget, TResult = void> {
  render(plan: TextRenderPlan, target: TTarget): TResult,
}

function isObjectLayer (layer: FancyRenderLayer): boolean {
  // GE v1 keeps gradient and texture as object-level capabilities. Glow is
  // already object-level by product semantics. Shadow remains range-level even
  // though the legacy Canvas renderer currently composites it as one surface.
  return layer.kind === 'glow' || layer.kind === 'gradient' || layer.kind === 'texture';
}

function normalizeLayer (layer: FancyRenderLayer): TextRenderLayer {
  if (layer.kind === 'texture') {
    // runtimePattern is a Canvas resource and must stay in the Canvas adapter.
    return { kind: 'texture', category: layer.category, params: layer.params };
  }

  return layer;
}

export function createTextRenderLayerPlans (
  layers: FancyRenderLayer[],
  layerIdPrefix = 'layer',
): { rangeLayers: TextRenderLayerPlan[], objectLayers: TextRenderLayerPlan[] } {
  const rangeLayers: TextRenderLayerPlan[] = [];
  const objectLayers: TextRenderLayerPlan[] = [];

  layers.forEach((layer, order) => {
    const plan: TextRenderLayerPlan = {
      layerId: `${layerIdPrefix}-${order}`,
      order,
      stage: isObjectLayer(layer) ? 'object' : 'range',
      layer: normalizeLayer(layer),
    };

    if (plan.stage === 'object') {
      objectLayers.push(plan);
    } else {
      rangeLayers.push(plan);
    }
  });

  return { rangeLayers, objectLayers };
}

function normalizePadding (padding: TextRenderPlanBuildOptions['padding']): TextGeometry['padding'] {
  return {
    left: padding?.left ?? 0,
    right: padding?.right ?? 0,
    top: padding?.top ?? 0,
    bottom: padding?.bottom ?? 0,
  };
}

/**
 * Builds the first, one-range TextRenderPlan used by ordinary TextComponent.
 *
 * This is deliberately a data-only builder: it does not touch Canvas APIs,
 * decide batching, or allocate a rendering surface.
 */
export function buildTextRenderPlanFromCharInfo (
  linesInput: TextLineInput[],
  layers: FancyRenderLayer[],
  options: TextRenderPlanBuildOptions,
): TextRenderPlan {
  const sourceRangeId = options.sourceRangeId ?? 'text';
  const layerIdPrefix = options.layerIdPrefix ?? 'layer';
  const lines: PositionedTextLine[] = [];
  const glyphs: PositionedGlyph[] = [];
  let glyphId = 0;

  linesInput.forEach((line, lineId) => {
    const originX = options.baseXPerLine?.[lineId] ?? 0;
    const glyphIds: number[] = [];

    line.chars.forEach((glyph, charIndex) => {
      const x = originX + (line.charOffsetX[charIndex] ?? 0);

      glyphs.push({
        id: glyphId,
        glyph,
        x,
        y: line.y,
        lineId,
        sourceRangeId,
        fontRef: options.fontRef,
      });
      glyphIds.push(glyphId);
      glyphId++;
    });

    lines.push({
      lineId,
      baselineY: line.y,
      width: line.width,
      originX,
      glyphIds,
    });
  });

  const { rangeLayers, objectLayers } = createTextRenderLayerPlans(layers, layerIdPrefix);

  const logicalSize = options.logicalSize ?? { width: 0, height: 0 };
  const renderSize = options.renderSize ?? logicalSize;
  const padding = normalizePadding(options.padding);
  const contentBounds = options.contentBounds;
  const effectBounds = contentBounds
    ? {
      x: contentBounds.x - padding.left,
      y: contentBounds.y - padding.top,
      width: contentBounds.width + padding.left + padding.right,
      height: contentBounds.height + padding.top + padding.bottom,
    }
    : undefined;

  return {
    glyphs,
    lines,
    rangePlans: [{
      sourceRangeId,
      glyphIds: glyphs.map(glyph => glyph.id),
      basicStyle: { fontRef: options.fontRef },
      layers: rangeLayers,
    }],
    objectPlan: { layers: objectLayers },
    geometry: { contentBounds, effectBounds, padding, logicalSize, renderSize },
  };
}

/**
 * Converts a plan back to the legacy CharInfo shape while the Canvas backend
 * is still backed by renderWithTextLayers().
 */
export function planToLegacyCharInfo (plan: TextRenderPlan): TextLineInput[] {
  return plan.lines.map(line => ({
    y: line.baselineY,
    width: line.width,
    chars: line.glyphIds.map(glyphId => plan.glyphs[glyphId].glyph),
    charOffsetX: line.glyphIds.map(glyphId => plan.glyphs[glyphId].x - line.originX),
  }));
}
