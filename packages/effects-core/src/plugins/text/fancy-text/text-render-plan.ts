import type * as spec from '@galacean/effects-specification';
import { isObjectFancyLayer, type FancyRenderLayer } from './fancy-types';

export interface TextLineInput {
  y: number,
  width: number,
  chars: string[],
  charOffsetX: number[],
}

/** A Canvas-independent subset of FancyRenderLayer used by the render plan. */
export type TextRenderLayer =
  | Exclude<FancyRenderLayer, { kind: 'texture' }>
  | Extract<FancyRenderLayer, { kind: 'texture' }>;

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

export type TextDirection = 'ltr' | 'rtl';

/**
 * A text segment that must be handed to Canvas as one string.
 *
 * This is a paint unit, not a shaping implementation: layout decides the
 * segment text, anchor and direction, while the Canvas adapter performs the
 * browser's normal text shaping when it paints the segment.
 */
export interface TextPaintSegment {
  id: number,
  text: string,
  x: number,
  y: number,
  lineId: number,
  sourceRangeId: string,
  fontRef: string,
  direction?: TextDirection,
}

export type TextPaintUnit =
  | { kind: 'glyph', glyphId: number }
  | { kind: 'segment', segmentId: number };

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
  /** Optional mixed glyph/segment stream used by the Canvas painter. */
  paintUnits?: TextPaintUnit[],
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
  textSegments?: TextPaintSegment[],
  lines: PositionedTextLine[],
  rangePlans: RangePlan[],
  objectPlan: ObjectPlan,
  geometry: TextGeometry,
}

export interface TextRenderPlanBuildOptions {
  fontRef: string,
  /** Plain-text fill color mirrored into the range basicStyle so the unified
   *  backend honors it the same way it honors RichText's per-range fontColor.
   *  Falls back to the text fill color when omitted. */
  fillColor?: spec.vec4,
  sourceRangeId?: string,
  baseXPerLine?: number[],
  contentBounds?: TextBounds,
  logicalSize?: TextSize,
  renderSize?: TextSize,
  padding?: Partial<TextGeometry['padding']>,
  layerIdPrefix?: string,
  /** Layout-provided full-text paint segments (e.g. RTL lines). */
  paintSegments?: Array<Omit<TextPaintSegment, 'id'>>,
}

export interface TextRenderBackend<TTarget, TResult = void> {
  render(plan: TextRenderPlan, target: TTarget): TResult,
}

function isObjectLayer (layer: FancyRenderLayer): boolean {
  return isObjectFancyLayer(layer);
}

function normalizeLayer (layer: FancyRenderLayer): TextRenderLayer {
  if (layer.kind === 'texture') {
    // Keep the resolved CanvasPattern on the runtime plan. This also handles
    // range-local texture layers; looking it up by a synthetic layer id loses
    // the resource when the pattern finishes loading asynchronously.
    return { kind: 'texture', category: layer.category, params: layer.params, runtimePattern: layer.runtimePattern };
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

  const textSegments: TextPaintSegment[] = (options.paintSegments ?? []).map((segment, id) => ({
    ...segment,
    id,
  }));
  const segmentsByLine = new Map<number, TextPaintSegment[]>();

  for (const segment of textSegments) {
    const lineSegments = segmentsByLine.get(segment.lineId) ?? [];

    lineSegments.push(segment);
    segmentsByLine.set(segment.lineId, lineSegments);
  }

  const paintUnits: TextPaintUnit[] = [];

  for (const line of lines) {
    const lineSegments = segmentsByLine.get(line.lineId);

    if (lineSegments?.length) {
      paintUnits.push(...lineSegments.map(segment => ({ kind: 'segment' as const, segmentId: segment.id })));
    } else {
      paintUnits.push(...line.glyphIds.map(glyphId => ({ kind: 'glyph' as const, glyphId })));
    }
  }

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
    textSegments,
    lines,
    rangePlans: [{
      sourceRangeId,
      glyphIds: glyphs.map(glyph => glyph.id),
      basicStyle: { fontRef: options.fontRef, fillColor: options.fillColor },
      layers: rangeLayers,
      paintUnits,
    }],
    objectPlan: { layers: objectLayers },
    geometry: { contentBounds, effectBounds, padding, logicalSize, renderSize },
  };
}

/**
 * Converts a plan back to the legacy CharInfo shape for external compatibility
 * callers. The ordinary-text main path no longer uses this bridge.
 */
export function planToLegacyCharInfo (plan: TextRenderPlan): TextLineInput[] {
  return plan.lines.map(line => ({
    y: line.baselineY,
    width: line.width,
    chars: line.glyphIds.map(glyphId => plan.glyphs[glyphId].glyph),
    charOffsetX: line.glyphIds.map(glyphId => plan.glyphs[glyphId].x - line.originX),
  }));
}
