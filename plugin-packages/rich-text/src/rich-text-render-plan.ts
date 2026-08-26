import { assembleTextRenderPlan, createTextFont } from '@galacean/effects';
import type {
  PositionedGlyph,
  PositionedTextLine,
  RangePlan,
  RangeTextStyle,
  TextBounds,
  TextEffectPlan,
  TextFont,
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

export interface RichTextRenderPlanOptions extends Pick<TextRenderPlanBuildOptions, 'logicalSize' | 'renderSize' | 'padding' | 'renderScale'> {
  textStyle: TextStyle,
  wrapResult: WrapResult,
  horizontalAlignResult: HorizontalAlignResult,
  verticalAlignResult: VerticalAlignResult,
  overflowResult: OverflowResult,
  effectPlan: TextEffectPlan,
}

function resolveFont (options: RichLine['richOptions'][number], textStyle: TextStyle): TextFont {
  return createTextFont({
    size: options.fontSize,
    family: options.fontFamily ?? textStyle.fontFamily,
    weight: options.fontWeight ?? textStyle.textWeight,
    style: options.fontStyle ?? textStyle.fontStyle,
  });
}

function fontToCss (font: TextFont): string {
  const family = ['serif', 'sans-serif', 'monospace', 'courier'].includes(font.family)
    ? font.family
    : `"${font.family}"`;
  let fontDesc = `${font.size}px ${family}`;

  if (font.weight !== 'normal') {
    fontDesc = `${font.weight} ${fontDesc}`;
  }

  if (font.style !== 'normal') {
    fontDesc = `${font.style} ${fontDesc}`;
  }

  return fontDesc;
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
  const { textStyle, wrapResult, horizontalAlignResult, verticalAlignResult, overflowResult } = options;
  const glyphs: PositionedGlyph[] = [];
  const lines: PositionedTextLine[] = [];
  const glyphIdsByRange = new Map<string, number[]>();
  const styleByRange = new Map<string, RangeTextStyle>();
  const fonts: TextFont[] = [];
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
      const font = resolveFont(richOptions, textStyle);

      fonts.push(font);
      const fillColor = resolveFillColor(richOptions, textStyle);

      charDetails.forEach(charDetail => {
        glyphs.push({
          id: glyphId,
          glyphId: charDetail.char,
          x: originX + segmentStartX + charDetail.x,
          y: baselineY,
          lineId,
          sourceRangeId,
          fontId: font.id,
        });
        lineGlyphIds.push(glyphId);
        rangeGlyphIds.push(glyphId);
        glyphId++;
      });

      glyphIdsByRange.set(sourceRangeId, rangeGlyphIds);
      styleByRange.set(sourceRangeId, { fontId: font.id, fillColor });
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

  const fallbackFont = createTextFont({
    size: textStyle.fontSize,
    family: textStyle.fontFamily,
    weight: textStyle.textWeight,
    style: textStyle.fontStyle,
  });
  const rangePlans: RangePlan[] = Array.from(glyphIdsByRange, ([sourceRangeId, glyphIds]) => ({
    sourceRangeId,
    glyphIds,
    basicStyle: styleByRange.get(sourceRangeId) ?? { fontId: fallbackFont.id },
  }));
  const contentBounds = buildContentBounds(lines, wrapResult, verticalAlignResult, overflowResult);

  return assembleTextRenderPlan({
    fonts,
    glyphs,
    lines,
    rangePlans,
    effects: options.effectPlan,
    defaultFillColor: textStyle.textColor,
    geometry: {
      contentBounds,
      logicalSize: options.logicalSize ?? { width: overflowResult.canvasWidth, height: overflowResult.canvasHeight },
      renderSize: options.renderSize ?? options.logicalSize ?? { width: overflowResult.canvasWidth, height: overflowResult.canvasHeight },
      padding: options.padding,
      renderScale: options.renderScale,
    },
  });
}

/** Canvas backend for the basic RichText fill stage. */
export class CanvasRichTextFillBackend implements TextRenderBackend<CanvasRenderingContext2D> {
  render (plan: TextRenderPlan, context: CanvasRenderingContext2D): void {
    const styleByRange = new Map(
      plan.rangePlans.map(range => [range.sourceRangeId, range.basicStyle]),
    );

    for (const glyph of plan.glyphs) {
      const rangeStyle = styleByRange.get(glyph.sourceRangeId);

      const font = plan.fonts.find(item => item.id === (rangeStyle?.fontId ?? glyph.fontId));

      if (font) {
        context.font = fontToCss(font);
      }
      if (rangeStyle?.fillColor) {
        const [r, g, b, a] = rangeStyle.fillColor;

        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      context.fillText(String(glyph.glyphId), glyph.x, glyph.y);
    }
  }
}
