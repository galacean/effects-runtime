import type { FancyRenderLayer, PositionedGlyph, RangePlan, TextRenderBackend, TextRenderLayerPlan, TextRenderPlan, TextStyle, spec } from '@galacean/effects';
import { CanvasRichTextFillBackend } from './rich-text-render-plan';

export interface TextEffectPadding {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

/** Computes conservative symmetric padding for the current GE fancy layers. */
export function calculateTextEffectPadding (textStyle: TextStyle): TextEffectPadding {
  const outlinePad = textStyle.isOutlined && textStyle.outlineWidth > 0
    ? Math.ceil(textStyle.outlineWidth * 2)
    : 0;
  let shadowPad = textStyle.hasShadow
    ? Math.ceil(Math.abs(textStyle.shadowOffsetX) + Math.abs(textStyle.shadowOffsetY) + textStyle.shadowBlur)
    : 0;
  let glowPad = 0;
  let strokePad = 0;

  for (const layer of textStyle.fancyRenderStyle?.layers ?? []) {
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
 * Range parameters are shared in v1, but glyph ownership remains range-aware.
 * Each shadow layer is rendered from the ranges that own that layer. This keeps
 * the range-level shadow seam explicit while still allowing shared parameters
 * to be batched into one shadow surface.
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

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(contentCanvas, 0, 0);

    // destination-over keeps effects behind the already drawn content.
    for (const layerPlan of glows) {
      this.compositeGlow(context, contentCanvas, layerPlan);
    }
    for (const group of shadowGroups) {
      const shadowSurface = document.createElement('canvas');

      shadowSurface.width = context.canvas.width;
      shadowSurface.height = context.canvas.height;
      const shadowContext = shadowSurface.getContext('2d');

      if (!shadowContext) {
        continue;
      }

      shadowContext.setTransform(contentTransform);
      this.renderShadowSource(plan, shadowContext, group.ranges);
      this.compositeShadow(context, shadowSurface, group.layerPlan);
    }

    context.restore();
  }

  private renderContent (
    plan: TextRenderPlan,
    context: CanvasRenderingContext2D,
    ranges = plan.rangePlans,
  ): void {
    context.textBaseline = 'alphabetic';
    const rangeLayers = this.getRangeContentLayers(ranges);
    const contentLayers = [
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
          this.drawSolidFill(plan, context, layerRanges);

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

  private renderShadowSource (
    plan: TextRenderPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
  ): void {
    // Shadow is range-owned, but its source is the complete visible content
    // for those ranges, including object-level gradient/texture paint.
    this.renderContent(plan, context, ranges);
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

    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        glyphContext.strokeStyle = colorToCss(color);
        glyphContext.lineJoin = 'round';
        glyphContext.lineWidth = width;
        glyphContext.strokeText(glyph.glyph, glyph.x, glyph.y);
      });
    }
  }

  private drawSolidFill (plan: TextRenderPlan, context: CanvasRenderingContext2D, ranges: RangePlan[]): void {
    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        glyphContext.fillStyle = colorToCss(range.basicStyle.fillColor ?? this.options.textStyle.textColor);
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

  private getRangeContentLayers (ranges: RangePlan[]): TextRenderLayerPlan[] {
    const seen = new Set<string>();
    const result: TextRenderLayerPlan[] = [];

    for (const range of ranges) {
      for (const layer of range.layers) {
        if ((layer.layer.kind === 'single-stroke' || layer.layer.kind === 'solid-fill') && !seen.has(layer.layerId)) {
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

  private compositeShadow (context: CanvasRenderingContext2D, surface: HTMLCanvasElement, layerPlan: TextRenderLayerPlan): void {
    if (layerPlan.layer.kind !== 'shadow') {
      return;
    }

    context.save();
    context.shadowColor = colorToCss(layerPlan.layer.params.color);
    context.shadowBlur = layerPlan.layer.params.blur;
    context.shadowOffsetX = layerPlan.layer.params.offsetX;
    context.shadowOffsetY = layerPlan.layer.params.offsetY;
    context.globalCompositeOperation = 'destination-over';
    context.drawImage(surface, 0, 0);
    context.restore();
  }
}
