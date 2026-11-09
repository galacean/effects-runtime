import { EffectsObject, spec } from '@galacean/effects';
import type { GradientPaint, ItemRenderer, ShapeComponent, SolidPaint, StrokeAttributes, Texture, TexturePaint } from '@galacean/effects';
import type { Data } from './scene-values';
import { jsonData } from './scene-values';

/** Read authored geometry and paint properties without serializing generated GPU resources. */
export function readShapeComponentData (component: ShapeComponent): Data {
  const reference = (texture?: Texture): spec.DataPath | undefined => texture && texture !== component.engine.assetServer.whiteTexture
    ? { id: texture.getInstanceId() } : undefined;
  const paintData = (paint: SolidPaint | GradientPaint | TexturePaint): Data => {
    if (paint.type === spec.FillType.Solid) {
      const { r, g, b, a } = paint.color;

      return { type: paint.type, color: { r, g, b, a } };
    }
    if (paint.type === spec.FillType.Texture) {
      return { type: paint.type, texture: reference(paint.texture), scaleMode: paint.scaleMode,
        scalingFactor: paint.scalingFactor, opacity: paint.opacity, textureTransform: paint.textureTransform };
    }

    return { type: paint.type, startPoint: paint.startPoint, endPoint: paint.endPoint,
      gradientStops: [spec.ValueType.GRADIENT_COLOR, paint.gradientStops.stops.map(stop => [stop.time, stop.color.r, stop.color.g, stop.color.b, stop.color.a])] };
  };
  const renderer = Reflect.get(component, 'rendererOptions') as ItemRenderer;
  const stroke = Reflect.get(component, 'strokeAttributes') as StrokeAttributes;
  const paints = (key: 'fills' | 'strokes'): Data[] => (Reflect.get(component, key) as (SolidPaint | GradientPaint | TexturePaint)[]).map(paintData);
  const data: Data = { ...component.definition, ...component.shape, id: component.getInstanceId(), dataType: spec.DataType.ShapeComponent, _enabled: component.enabled,
    item: component.item ? { id: component.item.getInstanceId() } : component.definition.item,
    strokeWidth: component.strokeWidth, strokeCap: component.strokeCap, strokeJoin: component.strokeJoin,
    strokeAlignment: component.strokeAlignment, strokeMiterLimit: component.strokeMiterLimit, fills: paints('fills'), strokes: paints('strokes'),
    variableWidthPoints: stroke.variableWidthPoints ?? [],
    renderer: { side: renderer.side, occlusion: renderer.occlusion, transparentOcclusion: component.definition.renderer?.transparentOcclusion ?? false,
      blending: renderer.blending, texture: reference(renderer.texture) },
    mask: { isMask: component.maskManager.isMask, alphaMaskEnabled: component.maskManager.alphaMaskEnabled,
      references: component.definition.mask?.references ?? component.maskManager.getMaskReferences()
        .filter(ref => ref.maskable instanceof EffectsObject)
        .map(ref => ({ mask: { id: (ref.maskable as unknown as EffectsObject).getInstanceId() }, inverted: ref.inverted })) },
  };

  for (const key of ['fillTrimPath', 'strokeTrimPath'] as const) {
    const trim = component[key];

    if (trim) { data[key] = { mode: trim.mode, start: trim.start, end: trim.end, offset: trim.offset }; } else { delete data[key]; }
  }

  return jsonData(data);
}

/** Apply a complete shape edit through the component's existing data-loading entry point. */
export function applyShapeComponentData (component: ShapeComponent, data: Data): void {
  component.definition = jsonData(data);
  const next: Data = { ...data, _enabled: component.enabled };

  component.fromData(next as spec.ShapeComponentData);
}
