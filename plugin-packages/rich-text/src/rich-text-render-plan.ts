import { createTextRenderLayerPlans } from '@galacean/effects';
import type {
  FancyRenderLayer,
  PositionedGlyph,
  PositionedTextLine,
  RangePlan,
  RangeTextStyle,
  TextBounds,
  TextRenderBackend,
  TextRenderPlan,
  TextRenderPlanBuildOptions,
  TextStyle,
  spec,
} from '@galacean/effects';
import type {
  HorizontalAlignResult,
  OverflowResult,
  RichLine,
  VerticalAlignResult,
  WrapResult,
} from './strategies/rich-text-interfaces';

export interface RichTextRenderPlanOptions extends Pick<TextRenderPlanBuildOptions, 'logicalSize' | 'renderSize' | 'padding'> {
  textStyle: TextStyle,
  wrapResult: WrapResult,
  horizontalAlignResult: HorizontalAlignResult,
  verticalAlignResult: VerticalAlignResult,
  overflowResult: OverflowResult,
  layers?: FancyRenderLayer[],
}

function resolveFontRef (options: RichLine['richOptions'][number], textStyle: TextStyle): string {
  const fontSize = options.fontSize;
  const fontFamily = options.fontFamily ?? textStyle.fontFamily;
  const fontWeight = options.fontWeight ?? textStyle.textWeight;
  const fontStyle = options.fontStyle ?? textStyle.fontStyle;

  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

function resolveFillColor (options: RichLine['richOptions'][number], textStyle: TextStyle): spec.vec4 {
  const color = options.fontColor ?? textStyle.textColor;

  return [...color] as spec.vec4;
}

function buildContentBounds (
  lines: PositionedTextLine[],
  wrapResult: WrapResult,
  verticalAlignResult: VerticalAlignResult,
  overflowResult: OverflowResult,
): TextBounds | undefined {
  if (lines.length === 0) {
    return undefined;
  }

  const minX = Math.min(...lines.map(line => line.originX));
  const maxX = Math.max(...lines.map(line => line.originX + line.width));
  const baseY = verticalAlignResult.baselineY + overflowResult.renderOffsetY;
  const top = baseY + (wrapResult.bboxTop ?? 0);
  const height = wrapResult.bboxHeight ?? wrapResult.totalHeight;

  return { x: minX, y: top, width: Math.max(0, maxX - minX), height: Math.max(0, height) };
}

/** Builds a range-aware render plan from the completed RichText layout output. */
export function buildRichTextRenderPlan (options: RichTextRenderPlanOptions): TextRenderPlan {
  const {
    textStyle,
    wrapResult,
    horizontalAlignResult,
    verticalAlignResult,
    overflowResult,
    layers = [],
  } = options;
  const glyphs: PositionedGlyph[] = [];
  const lines: PositionedTextLine[] = [];
  const glyphIdsByRange = new Map<string, number[]>();
  const styleByRange = new Map<string, RangeTextStyle>();
  let glyphId = 0;
  let baselineY = verticalAlignResult.baselineY + overflowResult.renderOffsetY;

  wrapResult.lines.forEach((line, lineId) => {
    const originX = horizontalAlignResult.lineOffsets[lineId] + overflowResult.renderOffsetX;
    const lineGlyphIds: number[] = [];

    line.richOptions.forEach((richOptions, segmentIndex) => {
      const segmentStartX = line.offsetX[segmentIndex] ?? 0;
      const charDetails = line.chars[segmentIndex] ?? [];
      const sourceRangeId = richOptions.sourceRangeId;
      const rangeGlyphIds = glyphIdsByRange.get(sourceRangeId) ?? [];
      const fontRef = resolveFontRef(richOptions, textStyle);
      const fillColor = resolveFillColor(richOptions, textStyle);

      charDetails.forEach(charDetail => {
        glyphs.push({
          id: glyphId,
          glyph: charDetail.char,
          x: originX + segmentStartX + charDetail.x,
          y: baselineY,
          lineId,
          sourceRangeId,
          fontRef,
        });
        lineGlyphIds.push(glyphId);
        rangeGlyphIds.push(glyphId);
        glyphId++;
      });

      glyphIdsByRange.set(sourceRangeId, rangeGlyphIds);
      styleByRange.set(sourceRangeId, { fontRef, fillColor });
    });

    lines.push({
      lineId,
      baselineY,
      width: line.width,
      originX,
      glyphIds: lineGlyphIds,
    });

    if (lineId < wrapResult.lines.length - 1) {
      baselineY += wrapResult.lines[lineId + 1].lineHeight;
    }
  });

  const { rangeLayers, objectLayers } = createTextRenderLayerPlans(layers);
  const rangePlans: RangePlan[] = Array.from(glyphIdsByRange, ([sourceRangeId, glyphIds]) => ({
    sourceRangeId,
    glyphIds,
    basicStyle: styleByRange.get(sourceRangeId) ?? { fontRef: textStyle.fontDesc },
    layers: rangeLayers,
  }));
  const padding = {
    left: options.padding?.left ?? 0,
    right: options.padding?.right ?? 0,
    top: options.padding?.top ?? 0,
    bottom: options.padding?.bottom ?? 0,
  };
  const logicalSize = options.logicalSize ?? {
    width: overflowResult.canvasWidth,
    height: overflowResult.canvasHeight,
  };
  const renderSize = options.renderSize ?? logicalSize;
  const contentBounds = buildContentBounds(lines, wrapResult, verticalAlignResult, overflowResult);
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
    rangePlans,
    objectPlan: { layers: objectLayers },
    geometry: { contentBounds, effectBounds, padding, logicalSize, renderSize },
  };
}

/** Canvas backend for the basic RichText fill stage. */
export class CanvasRichTextFillBackend implements TextRenderBackend<CanvasRenderingContext2D> {
  render (plan: TextRenderPlan, context: CanvasRenderingContext2D): void {
    const styleByRange = new Map(
      plan.rangePlans.map(range => [range.sourceRangeId, range.basicStyle]),
    );

    for (const glyph of plan.glyphs) {
      const rangeStyle = styleByRange.get(glyph.sourceRangeId);

      context.font = rangeStyle?.fontRef ?? glyph.fontRef;
      if (rangeStyle?.fillColor) {
        const [r, g, b, a] = rangeStyle.fillColor;

        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      context.fillText(glyph.glyph, glyph.x, glyph.y);
    }
  }
}
