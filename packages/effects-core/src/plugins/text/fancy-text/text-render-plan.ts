import type * as spec from '@galacean/effects-specification';
import type { TextEffectPlan } from './text-effect-plan';

export interface TextLineInput {
  y: number,
  width: number,
  chars: string[],
  charOffsetX: number[],
}

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

/** A logical font resource referenced by id from a TextRenderPlan. */
export interface TextFont {
  id: string,
  family: string,
  size: number,
  weight: spec.TextWeight,
  style: spec.FontStyle,
}

export type TextDirection = 'ltr' | 'rtl';
export type TextGlyphId = string | number;

/** A shaped run that a backend can paint as text or resolve to glyph ids. */
export interface TextShapingRun {
  id: number,
  text: string,
  x: number,
  y: number,
  lineId: number,
  sourceRangeId: string,
  fontId: string,
  direction?: TextDirection,
  glyphIds?: number[],
}

/** A positioned logical glyph that a concrete backend resolves to a resource. */
export interface PositionedGlyph {
  id: number,
  glyphId: TextGlyphId,
  x: number,
  y: number,
  lineId: number,
  sourceRangeId: string,
  fontId: string,
  advance?: number,
  bounds?: TextBounds,
  sourceCluster?: number,
}

export type TextDrawUnit =
  | { kind: 'glyph', glyphId: number }
  | { kind: 'run', runId: number };

export interface PositionedTextLine {
  lineId: number,
  baselineY: number,
  width: number,
  originX: number,
  glyphIds: number[],
}

export interface RangeTextStyle {
  fontId: string,
  fillColor?: spec.vec4,
}

export interface RangePlan {
  sourceRangeId: string,
  glyphIds: number[],
  basicStyle: RangeTextStyle,
  /** Optional mixed glyph/run stream supplied by the shaping stage. */
  drawUnits?: TextDrawUnit[],
}

export interface TextGeometry {
  contentBounds?: TextBounds,
  effectBounds?: TextBounds,
  padding: { left: number, right: number, top: number, bottom: number },
  logicalSize: TextSize,
  renderSize: TextSize,
  /** Logical-to-surface paint scale used by Canvas/MSDF adapters. */
  renderScale?: number,
}

export interface TextRenderPlan {
  fonts: TextFont[],
  glyphs: PositionedGlyph[],
  shapingRuns?: TextShapingRun[],
  lines: PositionedTextLine[],
  rangePlans: RangePlan[],
  effects: TextEffectPlan,
  defaultFillColor?: spec.vec4,
  geometry: TextGeometry,
}

/** The source-neutral input consumed by the shared plan assembler. */
export interface TextPlanAssemblyInput {
  fonts: TextFont[],
  glyphs: PositionedGlyph[],
  shapingRuns?: TextShapingRun[],
  lines: PositionedTextLine[],
  rangePlans: RangePlan[],
  effects: TextEffectPlan,
  defaultFillColor?: spec.vec4,
  geometry: {
    contentBounds?: TextBounds,
    effectBounds?: TextBounds,
    padding?: Partial<TextGeometry['padding']>,
    logicalSize: TextSize,
    renderSize: TextSize,
    renderScale?: number,
  },
}

/**
 * Common final assembly for ordinary TextComponent and RichText plans.
 * Source-specific builders should only adapt their layout result into this
 * input; they should not duplicate geometry/font normalization.
 */
export function assembleTextRenderPlan (input: TextPlanAssemblyInput): TextRenderPlan {
  const padding = {
    left: input.geometry.padding?.left ?? 0,
    right: input.geometry.padding?.right ?? 0,
    top: input.geometry.padding?.top ?? 0,
    bottom: input.geometry.padding?.bottom ?? 0,
  };
  const effectBounds = input.geometry.effectBounds ?? (input.geometry.contentBounds
    ? {
      x: input.geometry.contentBounds.x - padding.left,
      y: input.geometry.contentBounds.y - padding.top,
      width: input.geometry.contentBounds.width + padding.left + padding.right,
      height: input.geometry.contentBounds.height + padding.top + padding.bottom,
    }
    : undefined);
  const fonts = input.fonts.filter((font, index, list) =>
    list.findIndex(item => item.id === font.id) === index,
  );

  return {
    fonts,
    glyphs: input.glyphs,
    shapingRuns: input.shapingRuns,
    lines: input.lines,
    rangePlans: input.rangePlans,
    effects: input.effects,
    defaultFillColor: input.defaultFillColor,
    geometry: {
      contentBounds: input.geometry.contentBounds,
      effectBounds,
      padding,
      logicalSize: input.geometry.logicalSize,
      renderSize: input.geometry.renderSize,
      renderScale: input.geometry.renderScale,
    },
  };
}

export interface TextRenderPlanBuildOptions {
  font: TextFont,
  effectPlan: TextEffectPlan,
  /** Plain-text fill color mirrored into the range basicStyle. */
  fillColor?: spec.vec4,
  sourceRangeId?: string,
  baseXPerLine?: number[],
  contentBounds?: TextBounds,
  logicalSize?: TextSize,
  renderSize?: TextSize,
  padding?: Partial<TextGeometry['padding']>,
  renderScale?: number,
  /** Additional font resources referenced by shaping runs. */
  fontTable?: TextFont[],
  /** Layout-provided shaping runs, for example RTL lines. */
  shapingRuns?: Array<Omit<TextShapingRun, 'id'>>,
}

export interface TextRenderBackend<TTarget, TResult = void> {
  render(plan: TextRenderPlan, target: TTarget): TResult,
}

export function createTextFontId (font: Omit<TextFont, 'id'>): string {
  return `${font.style}|${font.weight}|${font.size}|${font.family}`;
}

export function createTextFont (font: Omit<TextFont, 'id'>): TextFont {
  return { ...font, id: createTextFontId(font) };
}

/** Builds the ordinary TextComponent source input and assembles the plan. */
export function buildTextRenderPlanFromCharInfo (
  linesInput: TextLineInput[],
  options: TextRenderPlanBuildOptions,
): TextRenderPlan {
  const sourceRangeId = options.sourceRangeId ?? 'text';
  const lines: PositionedTextLine[] = [];
  const glyphs: PositionedGlyph[] = [];
  let glyphId = 0;

  linesInput.forEach((line, lineId) => {
    const originX = options.baseXPerLine?.[lineId] ?? 0;
    const lineGlyphIds: number[] = [];

    line.chars.forEach((glyph, charIndex) => {
      const x = originX + (line.charOffsetX[charIndex] ?? 0);

      glyphs.push({
        id: glyphId,
        glyphId: glyph,
        x,
        y: line.y,
        lineId,
        sourceRangeId,
        fontId: options.font.id,
      });
      lineGlyphIds.push(glyphId);
      glyphId++;
    });

    lines.push({
      lineId,
      baselineY: line.y,
      width: line.width,
      originX,
      glyphIds: lineGlyphIds,
    });
  });

  const shapingRuns: TextShapingRun[] = (options.shapingRuns ?? []).map((run, id) => ({ ...run, id }));
  const runsByLine = new Map<number, TextShapingRun[]>();

  for (const run of shapingRuns) {
    const lineRuns = runsByLine.get(run.lineId) ?? [];

    lineRuns.push(run);
    runsByLine.set(run.lineId, lineRuns);
  }

  const drawUnits: TextDrawUnit[] = [];

  for (const line of lines) {
    const lineRuns = runsByLine.get(line.lineId);

    if (lineRuns?.length) {
      drawUnits.push(...lineRuns.map(run => ({ kind: 'run' as const, runId: run.id })));
    } else {
      drawUnits.push(...line.glyphIds.map(id => ({ kind: 'glyph' as const, glyphId: id })));
    }
  }

  const rangePlans: RangePlan[] = [{
    sourceRangeId,
    glyphIds: glyphs.map(glyph => glyph.id),
    basicStyle: { fontId: options.font.id, fillColor: options.fillColor },
    drawUnits,
  }];

  return assembleTextRenderPlan({
    fonts: [options.font, ...(options.fontTable ?? [])],
    glyphs,
    shapingRuns,
    lines,
    rangePlans,
    effects: options.effectPlan,
    defaultFillColor: options.fillColor,
    geometry: {
      contentBounds: options.contentBounds,
      padding: options.padding,
      logicalSize: options.logicalSize ?? { width: 0, height: 0 },
      renderSize: options.renderSize ?? options.logicalSize ?? { width: 0, height: 0 },
      renderScale: options.renderScale,
    },
  });
}

/** Converts a plan back to the legacy CharInfo shape for compatibility callers. */
export function planToLegacyCharInfo (plan: TextRenderPlan): TextLineInput[] {
  return plan.lines.map(line => ({
    y: line.baselineY,
    width: line.width,
    chars: line.glyphIds.map(id => String(plan.glyphs[id].glyphId)),
    charOffsetX: line.glyphIds.map(id => plan.glyphs[id].x - line.originX),
  }));
}
