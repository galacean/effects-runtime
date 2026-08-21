import type * as spec from '@galacean/effects-specification';
import type { TextStyle } from '../text-style';
import type { FancyRenderLayer } from './fancy-types';
import type {
  PositionedGlyph,
  RangePlan,
  TextRenderBackend,
  TextRenderLayerPlan,
  TextRenderPlan,
} from './text-render-plan';

export interface CanvasTextRenderBackendOptions {
  textStyle: TextStyle,
  layers: FancyRenderLayer[],
}

function colorToCss (color: spec.vec4): string {
  const scale = color.slice(0, 3).some(channel => channel > 1) ? 1 : 255;
  const [r, g, b, a] = color;

  return `rgba(${Math.round(r * scale)}, ${Math.round(g * scale)}, ${Math.round(b * scale)}, ${a})`;
}

interface CachedCanvasSurface {
  canvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
}

const cachedSurfaces = new Map<string, CachedCanvasSurface>();
const CACHED_SURFACES_MAX = 8;

function getCachedSurface (key: string): CachedCanvasSurface | undefined {
  const entry = cachedSurfaces.get(key);

  if (entry) {
    cachedSurfaces.delete(key);
    cachedSurfaces.set(key, entry);
  }

  return entry;
}

function setCachedSurface (key: string, entry: CachedCanvasSurface): void {
  cachedSurfaces.delete(key);
  cachedSurfaces.set(key, entry);

  while (cachedSurfaces.size > CACHED_SURFACES_MAX) {
    const oldestKey = cachedSurfaces.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }
    cachedSurfaces.delete(oldestKey);
  }
}

/**
 * Canvas backend for the first RichText fancy slice.
 *
 * Range effects are rendered from the glyphs that own each layer. Ranges with
 * identical parameters can share a group; ranges with different parameters get
 * different source surfaces and blur passes. Object effects remain separate.
 */
export class CanvasTextRenderBackend implements TextRenderBackend<CanvasRenderingContext2D> {
  private readonly rawLayersById: Map<string, FancyRenderLayer>;

  constructor (private readonly options: CanvasTextRenderBackendOptions) {
    this.rawLayersById = new Map(options.layers.map((layer, index) => [`layer-${index}`, layer]));
  }

  render (plan: TextRenderPlan, context: CanvasRenderingContext2D): void {
    const contentCanvas = document.createElement('canvas');

    contentCanvas.width = context.canvas.width;
    contentCanvas.height = context.canvas.height;
    const contentTransform = context.getTransform();
    const contentContext = contentCanvas.getContext('2d');

    if (!contentContext) {
      this.renderSimpleFill(plan, context);

      return;
    }

    contentContext.setTransform(contentTransform);
    this.renderContent(plan, contentContext);

    const glows = plan.objectPlan.layers.filter(layer => layer.layer.kind === 'glow');
    const shadowGroups = this.getRangeLayerGroups(plan, 'shadow');
    let glowCanvas: HTMLCanvasElement | undefined;

    if (glows.length > 0) {
      const glowKey = this.buildGlowCacheKey(plan, contentTransform, context.canvas);
      const cachedGlow = getCachedSurface(glowKey);

      if (cachedGlow) {
        glowCanvas = cachedGlow.canvas;
      } else {
        const fillCanvas = document.createElement('canvas');

        fillCanvas.width = context.canvas.width;
        fillCanvas.height = context.canvas.height;
        const fillContext = fillCanvas.getContext('2d');

        if (fillContext) {
          fillContext.setTransform(contentTransform);
          // Object glow is based on the text fill/object content, not on the
          // range stroke. Otherwise changing one range's stroke changes the
          // shared glow source alpha and makes the glow of that range pulse.
          // Build an alpha-only mask for the shared object glow. The source
          // must not carry range RGB values, otherwise changing a segment's
          // fill color can leak into the shared glow even when its opacity is
          // stable.
          this.renderContent(plan, fillContext, plan.rangePlans, false, true);
        }

        const canvas = document.createElement('canvas');

        canvas.width = context.canvas.width;
        canvas.height = context.canvas.height;
        const glowContext = canvas.getContext('2d');

        if (glowContext) {
          glowContext.setTransform(1, 0, 0, 1, 0, 0);

          for (const layerPlan of glows) {
            this.compositeGlow(glowContext, fillCanvas, layerPlan);
          }
        }
        glowCanvas = canvas;
        setCachedSurface(glowKey, { canvas, offsetX: 0, offsetY: 0 });
      }
    }

    // Build range shadows on a separate transparent layer. Each source range
    // gets its own shadow surface; only the independent shadow results are
    // accumulated here. The text content is drawn afterwards so a Range Fill
    // cannot become the destination that composites another Range's shadow.
    const shadowCanvas = document.createElement('canvas');

    shadowCanvas.width = context.canvas.width;
    shadowCanvas.height = context.canvas.height;
    const shadowContext = shadowCanvas.getContext('2d');

    if (shadowContext) {
      shadowContext.setTransform(1, 0, 0, 1, 0, 0);
      shadowContext.globalCompositeOperation = 'source-over';

      for (const group of shadowGroups) {
        const shadowSurface = this.createShadowSurface(plan, group, context, contentTransform);

        if (shadowSurface) {
          this.compositeShadow(shadowContext, shadowSurface.canvas, shadowSurface.offsetX, shadowSurface.offsetY);
        }
      }
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-over';

    if (glowCanvas) {
      context.drawImage(glowCanvas, 0, 0);
    }
    context.drawImage(shadowCanvas, 0, 0);
    context.drawImage(contentCanvas, 0, 0);

    context.restore();
  }

  private renderSimpleFill (plan: TextRenderPlan, context: CanvasRenderingContext2D): void {
    context.textBaseline = 'alphabetic';

    for (const glyph of plan.glyphs) {
      const range = plan.rangePlans.find(item => item.sourceRangeId === glyph.sourceRangeId);
      const fillColor = range?.basicStyle.fillColor ?? this.options.textStyle.textColor;

      context.font = range?.basicStyle.fontRef ?? glyph.fontRef;
      context.fillStyle = colorToCss(fillColor);
      context.fillText(glyph.glyph, glyph.x, glyph.y);
    }
  }

  private buildTransformKey (contentTransform: DOMMatrix, canvas: HTMLCanvasElement): string {
    const transform = [
      contentTransform.a,
      contentTransform.b,
      contentTransform.c,
      contentTransform.d,
      contentTransform.e,
      contentTransform.f,
    ].map(value => value.toFixed(3)).join(',');

    return `${canvas.width}x${canvas.height}|${transform}`;
  }

  private buildGlowCacheKey (plan: TextRenderPlan, contentTransform: DOMMatrix, canvas: HTMLCanvasElement): string {
    const glyphs = plan.glyphs.map(glyph => `${glyph.glyph}|${glyph.x.toFixed(3)}|${glyph.y.toFixed(3)}|${glyph.fontRef}`).join(';');
    const glows = plan.objectPlan.layers
      .filter(layer => layer.layer.kind === 'glow')
      .map(layer => `${layer.layerId}|${JSON.stringify(layer.layer.params)}`)
      .join(';');

    return `glow|${this.buildTransformKey(contentTransform, canvas)}|${glyphs}|${glows}`;
  }

  private buildShadowCacheKey (
    plan: TextRenderPlan,
    group: { layerPlan: TextRenderLayerPlan, ranges: RangePlan[] },
    contentTransform: DOMMatrix,
    canvas: HTMLCanvasElement,
  ): string {
    const glyphs = group.ranges.flatMap(range => range.glyphIds.map(glyphId => {
      const glyph = plan.glyphs[glyphId];

      return glyph ? `${glyph.glyph}|${glyph.x.toFixed(3)}|${glyph.y.toFixed(3)}|${glyph.fontRef}` : '';
    })).join(';');
    const layers = group.ranges.flatMap(range => range.layers.map(layer => (
      layer.layer.kind === 'shadow' || layer.layer.kind === 'single-stroke'
        ? `${layer.layerId}|${JSON.stringify(layer.layer.params)}`
        : ''
    ))).join(';');

    return `shadow|${this.buildTransformKey(contentTransform, canvas)}|${glyphs}|${layers}`;
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
          this.drawStroke(plan, layerPlan, context, layerRanges, maskOnly);

          break;
        case 'solid-fill':
          this.drawSolidFill(plan, layerPlan, context, layerRanges, maskOnly);

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
  ): { canvas: HTMLCanvasElement, offsetX: number, offsetY: number } | undefined {
    if (group.layerPlan.layer.kind !== 'shadow') {
      return undefined;
    }

    // 阴影源是“几何 Mask”，不依赖 Fill 颜色/透明度。几何与参数不变时直接
    // 复用上一次的模糊结果，颜色拖动期间阴影开销降为 0。
    const cacheKey = this.buildShadowCacheKey(plan, group, contentTransform, target.canvas);
    const cached = getCachedSurface(cacheKey);

    if (cached) {
      return cached;
    }

    const { color, blur, offsetX, offsetY } = group.layerPlan.layer.params;
    const scaleX = Math.hypot(contentTransform.a, contentTransform.b) || 1;
    const scaleY = Math.hypot(contentTransform.c, contentTransform.d) || 1;
    const blurScale = Math.max(scaleX, scaleY);
    // 阴影源包含描边 Mask，包围盒外还需要覆盖描边宽度（圆角连接会再多伸一点）。
    let strokeWidth = 0;

    for (const range of group.ranges) {
      for (const layer of range.layers) {
        if (layer.layer.kind === 'single-stroke') {
          strokeWidth = Math.max(strokeWidth, layer.layer.params.width);
        }
      }
    }
    // 阴影画布只需要覆盖该组文字包围盒 + blur/offset/描边余量，而不是整张
    // 目标画布。Canvas shadowBlur 的成本随画布面积增长，全尺寸模糊是每次
    // 编辑 100ms+ 的主因。
    const pad = Math.ceil(
      blur * blurScale * 2
      + Math.max(Math.abs(offsetX) * scaleX, Math.abs(offsetY) * scaleY)
      + strokeWidth * blurScale
      + 8,
    );
    const probe = document.createElement('canvas');
    const probeContext = probe.getContext('2d');
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    if (probeContext) {
      for (const range of group.ranges) {
        probeContext.font = range.basicStyle.fontRef;

        for (const glyphId of range.glyphIds) {
          const glyph = plan.glyphs[glyphId];

          if (!glyph) {
            continue;
          }

          const metrics = probeContext.measureText(glyph.glyph);
          const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(glyph.fontRef)?.[1] ?? 20);
          const ascent = metrics.actualBoundingBoxAscent || fontSize;
          const descent = metrics.actualBoundingBoxDescent || fontSize * 0.3;
          const left = metrics.actualBoundingBoxLeft || 0;
          const right = metrics.actualBoundingBoxRight || metrics.width;
          const corners = [
            [glyph.x - left, glyph.y - ascent],
            [glyph.x + right, glyph.y - ascent],
            [glyph.x - left, glyph.y + descent],
            [glyph.x + right, glyph.y + descent],
          ];

          for (const [px, py] of corners) {
            const dx = contentTransform.a * px + contentTransform.c * py + contentTransform.e;
            const dy = contentTransform.b * px + contentTransform.d * py + contentTransform.f;

            minX = Math.min(minX, dx);
            minY = Math.min(minY, dy);
            maxX = Math.max(maxX, dx);
            maxY = Math.max(maxY, dy);
          }
        }
      }
    }

    if (!Number.isFinite(minX)) {
      return undefined;
    }

    const surfaceWidth = Math.max(1, Math.ceil(maxX - minX + pad * 2));
    const surfaceHeight = Math.max(1, Math.ceil(maxY - minY + pad * 2));

    // 源画布：只画该组 glyph 的几何 Mask（白色全 Alpha）。
    const sourceSurface = document.createElement('canvas');

    sourceSurface.width = surfaceWidth;
    sourceSurface.height = surfaceHeight;
    const sourceContext = sourceSurface.getContext('2d');

    if (!sourceContext) {
      return undefined;
    }

    sourceContext.setTransform(contentTransform);
    // 平移量在逻辑坐标系中换算（GE 文本变换为 scale + translate）。
    sourceContext.translate((pad - minX) / scaleX, (pad - minY) / scaleY);
    this.renderContent(plan, sourceContext, group.ranges, true, true);

    const shadowSurface = document.createElement('canvas');

    shadowSurface.width = surfaceWidth;
    shadowSurface.height = surfaceHeight;
    const shadowContext = shadowSurface.getContext('2d');

    if (!shadowContext) {
      return undefined;
    }

    // Draw the range source with Canvas's shadow state, then remove the
    // original glyph pixels. The resulting surface contains shadow only, so
    // each range is composited independently and cannot paint another range's
    // source glyphs or inherit a previous group's context state.
    shadowContext.save();
    shadowContext.shadowColor = colorToCss(color);
    // The source surface is already rasterized in the target bitmap's pixel
    // space, so shadow blur/offset keep the same logical->device scale as the
    // glyph coordinates.
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

    const result = {
      canvas: shadowSurface,
      offsetX: Math.round(minX - pad),
      offsetY: Math.round(minY - pad),
    };

    setCachedSurface(cacheKey, result);

    return result;
  }

  private drawStroke (
    plan: TextRenderPlan,
    layerPlan: TextRenderLayerPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
    maskOnly = false,
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
        glyphContext.strokeStyle = maskOnly ? 'rgb(255, 255, 255)' : colorToCss(color);
        glyphContext.lineJoin = 'round';
        glyphContext.lineWidth = width;
        glyphContext.strokeText(glyph.glyph, glyph.x, glyph.y);
      });
    }
  }

  private drawSolidFill (
    plan: TextRenderPlan,
    layerPlan: TextRenderLayerPlan,
    context: CanvasRenderingContext2D,
    ranges: RangePlan[],
    maskOnly = false,
  ): void {
    const layerColor = layerPlan.layer.kind === 'solid-fill' ? layerPlan.layer.params.color : undefined;

    for (const range of ranges) {
      this.drawRangeGlyphs(plan, range, context, (glyphContext, glyph) => {
        if (maskOnly) {
          // The shared object-glow source is a pure, full-alpha white silhouette.
          // Both the range fill RGB and its alpha are deliberately discarded so
          // the object glow depends only on the glow layer's own color / blur /
          // intensity. Letting the range fill alpha (fillOpacity) through makes
          // editing one segment's fill opacity pulse the glow halo of the whole
          // text object; letting the RGB through recolors it. Neither is allowed.
          glyphContext.fillStyle = 'rgb(255, 255, 255)';
        } else {
          // Honor colors in the same precedence RichText uses: the per-range
          // fill color wins; then the solid-fill layer's own color (so plain
          // text presets without a per-range fill still show their fill color);
          // finally the text style fallback. RichText's `basicStyle.fillColor`
          // is always set, so this stays byte-identical for rich text.
          const fillColor = range.basicStyle.fillColor ?? layerColor ?? this.options.textStyle.textColor;

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
    const groups: Array<{ layerPlan: TextRenderLayerPlan, ranges: RangePlan[] }> = [];

    for (const range of plan.rangePlans) {
      for (const layer of range.layers) {
        if (layer.layer.kind !== kind) {
          continue;
        }

        // Layer parameters may be shared, but the glyph coverage used to
        // generate a Shadow must remain owned by one source Range.
        groups.push({ layerPlan: layer, ranges: [range] });
      }
    }

    return groups.sort((a, b) => a.layerPlan.order - b.layerPlan.order);
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

  private compositeShadow (context: CanvasRenderingContext2D, surface: HTMLCanvasElement, offsetX: number, offsetY: number): void {
    context.save();
    context.globalCompositeOperation = 'source-over';
    context.drawImage(surface, offsetX, offsetY);
    context.restore();
  }
}
