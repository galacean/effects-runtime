import type { FancyRenderLayer, PositionedGlyph, RangePlan, TextRenderBackend, TextRenderLayerPlan, TextRenderPlan, TextStyle, spec } from '@galacean/effects';
import { CanvasRichTextFillBackend } from './rich-text-render-plan';

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

export interface CanvasRichTextFancyBackendOptions {
  textStyle: TextStyle,
  layers: FancyRenderLayer[],
}

function colorToCss (color: spec.vec4): string {
  const scale = color.slice(0, 3).some(channel => channel > 1) ? 1 : 255;
  const [r, g, b, a] = color;

  return `rgba(${Math.round(r * scale)}, ${Math.round(g * scale)}, ${Math.round(b * scale)}, ${a})`;
}

/**
 * Canvas backend for the first RichText fancy slice.
 *
 * Range effects are rendered from the glyphs that own each layer. Ranges with
 * identical parameters can share a group; ranges with different parameters get
 * different source surfaces and blur passes. Object effects remain separate.
 */
export class CanvasRichTextFancyBackend implements TextRenderBackend<CanvasRenderingContext2D> {
  private readonly rawLayersById: Map<string, FancyRenderLayer>;

  constructor (private readonly options: CanvasRichTextFancyBackendOptions) {
    this.rawLayersById = new Map(options.layers.map((layer, index) => [`layer-${index}`, layer]));
  }

  render (plan: TextRenderPlan, context: CanvasRenderingContext2D): void {
    const contentCanvas = document.createElement('canvas');

    contentCanvas.width = context.canvas.width;
    contentCanvas.height = context.canvas.height;
    const contentTransform = context.getTransform();
    const contentContext = contentCanvas.getContext('2d');

    if (!contentContext) {
      new CanvasRichTextFillBackend().render(plan, context);

      return;
    }

    contentContext.setTransform(contentTransform);
    this.renderContent(plan, contentContext);

    const glows = plan.objectPlan.layers.filter(layer => layer.layer.kind === 'glow');
    const shadowGroups = this.getRangeLayerGroups(plan, 'shadow');
    let glowSourceCanvas = contentCanvas;

    if (glows.length > 0) {
      const fillCanvas = document.createElement('canvas');

      fillCanvas.width = context.canvas.width;
      fillCanvas.height = context.canvas.height;
      const fillContext = fillCanvas.getContext('2d');

      if (fillContext) {
        fillContext.setTransform(contentTransform);
        // Object glow is based on the text fill/object content, not on the
        // range stroke. Otherwise changing one range's stroke changes the
        // shared glow source alpha and makes the glow of that range pulse.
        // Build an alpha-only mask for the shared object glow. The source must
        // not carry range RGB values, otherwise changing a segment's fill
        // color can leak into the shared glow even when its opacity is stable.
        this.renderContent(plan, fillContext, plan.rangePlans, false, true);
        glowSourceCanvas = fillCanvas;
      }
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(contentCanvas, 0, 0);

    // Paint range shadows before the object glow. Both effects stay behind the
    // text, but this ordering prevents the shared glow halo from hiding the
    // per-range shadow differences in the demo and in real compositions.
    for (const group of shadowGroups) {
      const shadowSurface = this.createShadowSurface(plan, group, context, contentTransform);

      if (shadowSurface) {
        this.compositeShadow(context, shadowSurface);
      }
    }
    for (const layerPlan of glows) {
      this.compositeGlow(context, glowSourceCanvas, layerPlan);
    }

    context.restore();
  }

  private renderContent (
    plan: TextRenderPlan,
    context: CanvasRenderingContext2D,
    ranges = plan.rangePlans,
    includeStrokes = true,
    maskOnly = false,
  ): void {
    context.textBaseline = 'alphabetic';
    const rangeLayers = this.getRangeContentLayers(ranges, includeStrokes);
    const contentLayers = maskOnly
      ? rangeLayers
      : [
        ...rangeLayers,
        ...plan.objectPlan.layers.filter(layer => layer.layer.kind === 'gradient' || layer.layer.kind === 'texture'),
      ].sort((a, b) => a.order - b.order);

    for (const layerPlan of contentLayers) {
      const layerRanges = this.getRangesForLayer(ranges, layerPlan);

      switch (layerPlan.layer.kind) {
        case 'single-stroke':
          this.drawStroke(plan, layerPlan, context, layerRanges);

          break;
        case 'solid-fill':
          this.drawSolidFill(plan, context, layerRanges, maskOnly);

          break;
        case 'gradient':
          this.drawGradient(plan, layerPlan, context, ranges);

          break;
        case 'texture':
          this.drawTexture(plan, layerPlan, context, ranges);

          break;
        default:
          // Shadow and glow are composited in separate passes.
          break;
      }
    }
  }

  private createShadowSurface (
    plan: TextRenderPlan,
    group: { layerPlan: TextRenderLayerPlan, ranges: RangePlan[] },
    target: CanvasRenderingContext2D,
    contentTransform: DOMMatrix,
  ): HTMLCanvasElement | undefined {
    if (group.layerPlan.layer.kind !== 'shadow') {
      return undefined;
    }

    // First render only the glyphs owned by this range/layer group. Keeping a
    // dedicated source surface is important: the blur must never consume the
    // complete text object, otherwise changing one range's shadow changes all
    // ranges visually.
    const sourceSurface = document.createElement('canvas');

    sourceSurface.width = target.canvas.width;
    sourceSurface.height = target.canvas.height;
    const sourceContext = sourceSurface.getContext('2d');

    if (!sourceContext) {
      return undefined;
    }

    sourceContext.setTransform(contentTransform);
    this.renderContent(plan, sourceContext, group.ranges);

    const shadowSurface = document.createElement('canvas');

    shadowSurface.width = target.canvas.width;
    shadowSurface.height = target.canvas.height;
    const shadowContext = shadowSurface.getContext('2d');

    if (!shadowContext) {
      return undefined;
    }

    const { color, blur, offsetX, offsetY } = group.layerPlan.layer.params;
    const scaleX = Math.hypot(contentTransform.a, contentTransform.b) || 1;
    const scaleY = Math.hypot(contentTransform.c, contentTransform.d) || 1;
    const blurScale = Math.max(scaleX, scaleY);

    // Draw the range source with Canvas's shadow state, then remove the
    // original glyph pixels. The resulting surface contains shadow only, so
    // each range is composited independently and cannot paint another range's
    // source glyphs or inherit a previous group's context state.
    shadowContext.save();
    shadowContext.shadowColor = colorToCss(color);
    shadowContext.shadowBlur = blur * blurScale;
    shadowContext.shadowOffsetX = offsetX * scaleX;
    shadowContext.shadowOffsetY = offsetY * scaleY;
    shadowContext.drawImage(sourceSurface, 0, 0);
    shadowContext.restore();

    shadowContext.save();
    shadowContext.globalCompositeOperation = 'destination-out';
    shadowContext.setTransform(1, 0, 0, 1, 0, 0);
    shadowContext.drawImage(sourceSurface, 0, 0);
    shadowContext.restore();

    return shadowSurface;
  }

  private drawStroke (
    plan: TextRenderPlan,
    layerPlan: TextRenderLayerPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
  ): void {
    if (layerPlan.layer.kind !== 'single-stroke') {
      return;
    }

    const { color, width } = layerPlan.layer.params;

    // Canvas 2D ignores lineWidth = 0 and keeps the previous valid width.
    // Treat a non-positive fancy stroke as disabled explicitly; otherwise a
    // zero-width range can accidentally reuse the preceding range's stroke
    // width and make its shadow/glow source brighter.
    if (!(width > 0)) {
      return;
    }

    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        glyphContext.strokeStyle = colorToCss(color);
        glyphContext.lineJoin = 'round';
        glyphContext.lineWidth = width;
        glyphContext.strokeText(glyph.glyph, glyph.x, glyph.y);
      });
    }
  }

  private drawSolidFill (
    plan: TextRenderPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
    maskOnly = false,
  ): void {
    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        const fillColor = range.basicStyle.fillColor ?? this.options.textStyle.textColor;

        if (maskOnly) {
          // Preserve source alpha for opacity control, but deliberately discard
          // the range RGB so a color edit cannot recolor the object glow.
          glyphContext.fillStyle = `rgba(255, 255, 255, ${fillColor[3]})`;
        } else {
          glyphContext.fillStyle = colorToCss(fillColor);
        }
        glyphContext.fillText(glyph.glyph, glyph.x, glyph.y);
      });
    }
  }

  private drawGradient (
    plan: TextRenderPlan,
    layerPlan: TextRenderLayerPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
  ): void {
    if (layerPlan.layer.kind !== 'gradient') {
      return;
    }

    const bounds = plan.geometry.contentBounds;

    if (!bounds) {
      return;
    }

    const angle = (layerPlan.layer.params.angle * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfLength = Math.abs(bounds.width * cos) + Math.abs(bounds.height * sin);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const gradient = context.createLinearGradient(
      cx - halfLength * cos,
      cy - halfLength * sin,
      cx + halfLength * cos,
      cy + halfLength * sin,
    );

    const colors = layerPlan.layer.params.colors;

    colors.forEach((color, index) => {
      const stop = colors.length === 1 ? 0 : index / (colors.length - 1);

      gradient.addColorStop(stop, colorToCss(color));
    });
    context.fillStyle = gradient;

    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        glyphContext.fillText(glyph.glyph, glyph.x, glyph.y);
      });
    }
  }

  private drawTexture (
    plan: TextRenderPlan,
    layerPlan: TextRenderLayerPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
  ): void {
    const rawLayer = this.rawLayersById.get(layerPlan.layerId);

    if (!rawLayer || rawLayer.kind !== 'texture' || !rawLayer.runtimePattern) {
      return;
    }

    const previousAlpha = context.globalAlpha;

    context.fillStyle = rawLayer.runtimePattern;
    context.globalAlpha = previousAlpha * (rawLayer.params.opacity ?? 1);
    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        glyphContext.fillText(glyph.glyph, glyph.x, glyph.y);
      });
    }
    context.globalAlpha = previousAlpha;
  }

  private drawRangeGlyphs (
    plan: TextRenderPlan,
    range: RangePlan,
    context: CanvasRenderingContext2D,
    draw: (context: CanvasRenderingContext2D, glyph: PositionedGlyph) => void,
  ): void {
    context.font = range.basicStyle.fontRef;
    for (const glyphId of range.glyphIds) {
      const glyph = plan.glyphs[glyphId];

      if (glyph) {
        draw(context, glyph);
      }
    }
  }

  private getRangeContentLayers (ranges: RangePlan[], includeStrokes = true): TextRenderLayerPlan[] {
    const seen = new Set<string>();
    const result: TextRenderLayerPlan[] = [];

    for (const range of ranges) {
      for (const layer of range.layers) {
        const isContentLayer = layer.layer.kind === 'solid-fill' || (includeStrokes && layer.layer.kind === 'single-stroke');

        if (isContentLayer && !seen.has(layer.layerId)) {
          seen.add(layer.layerId);
          result.push(layer);
        }
      }
    }

    return result.sort((a, b) => a.order - b.order);
  }

  private getRangesForLayer (ranges: RangePlan[], layerPlan: TextRenderLayerPlan): RangePlan[] {
    const matchingRanges = ranges.filter(range => range.layers.some(layer => layer.layerId === layerPlan.layerId));

    return matchingRanges.length > 0 ? matchingRanges : ranges;
  }

  private getRangeLayerGroups (
    plan: TextRenderPlan,
    kind: 'shadow' | 'single-stroke',
  ): Array<{ layerPlan: TextRenderLayerPlan, ranges: RangePlan[] }> {
    const groups = new Map<string, { layerPlan: TextRenderLayerPlan, ranges: RangePlan[] }>();

    for (const range of plan.rangePlans) {
      for (const layer of range.layers) {
        if (layer.layer.kind !== kind) {
          continue;
        }

        const group = groups.get(layer.layerId);

        if (group) {
          group.ranges.push(range);
        } else {
          groups.set(layer.layerId, { layerPlan: layer, ranges: [range] });
        }
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.layerPlan.order - b.layerPlan.order);
  }

  private compositeGlow (context: CanvasRenderingContext2D, surface: HTMLCanvasElement, layerPlan: TextRenderLayerPlan): void {
    if (layerPlan.layer.kind !== 'glow') {
      return;
    }

    context.save();
    context.shadowColor = colorToCss(layerPlan.layer.params.color);
    context.shadowBlur = layerPlan.layer.params.blur;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.globalCompositeOperation = 'destination-over';

    const repeat = Math.max(1, Math.round(layerPlan.layer.params.intensity));

    for (let index = 0; index < repeat; index++) {
      context.drawImage(surface, 0, 0);
    }
    context.restore();
  }

  private compositeShadow (context: CanvasRenderingContext2D, surface: HTMLCanvasElement): void {
    context.save();
    context.globalCompositeOperation = 'destination-over';
    context.drawImage(surface, 0, 0);
    context.restore();
  }
}
