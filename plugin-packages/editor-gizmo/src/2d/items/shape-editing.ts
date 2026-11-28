import { GradientValue, math, spec } from '@galacean/effects';
import type { GradientPaint, ShapeComponent, SolidPaint } from '@galacean/effects';

type PaintKind = 'fill' | 'stroke';

/** 渐变编辑入口与写入共用的校验；色标数量与着色器容量一致。 */
export function isValidGradientPaint (paint: GradientPaint | undefined): paint is GradientPaint {
  if (!paint) {
    return false;
  }
  const stops = paint.gradientStops.stops;

  // 展开空槽，避免 every 跳过缺失的色标。
  return stops.length >= 2 && stops.length <= 8
    && [paint.startPoint.x, paint.startPoint.y, paint.endPoint.x, paint.endPoint.y].every(Number.isFinite)
    && Array.from(stops).every((stop, index) => !!stop && Number.isFinite(stop.time) && stop.time >= 0 && stop.time <= 1
      && (index === 0 || stop.time > stops[index - 1].time)
      && [stop.color.r, stop.color.g, stop.color.b, stop.color.a].every(Number.isFinite));
}

function cloneColorPaint (paint: SolidPaint | GradientPaint): SolidPaint | GradientPaint {
  if (paint.type === spec.FillType.Solid) {
    return { type: paint.type, color: new math.Color().copyFrom(paint.color) };
  }

  return {
    ...paint,
    startPoint: paint.startPoint.clone(),
    endPoint: paint.endPoint.clone(),
    gradientStops: Object.assign(new GradientValue([]), {
      stops: paint.gradientStops.stops.map(stop => ({ time: stop.time, color: new math.Color().copyFrom(stop.color) })),
    }),
  };
}

/** 编辑器修改副本，提交前不会影响组件正在使用的 paint。 */
export function getColorPaint (component: ShapeComponent | undefined, kind: PaintKind, index: number): SolidPaint | GradientPaint | undefined {
  const paints = kind === 'fill' ? component?.fills : component?.strokes;
  const paint = paints?.[index];

  return paint && paint.type !== spec.FillType.Texture ? cloneColorPaint(paint) : undefined;
}

export function getGradientPaint (component: ShapeComponent | undefined, kind: PaintKind, index: number): GradientPaint | undefined {
  const paint = getColorPaint(component, kind, index);

  return paint?.type === spec.FillType.Solid ? undefined : paint;
}

/** 只编辑已有的纯色/渐变槽位，保持其他填充、描边和形状几何。 */
export function setColorPaint (component: ShapeComponent, kind: PaintKind, index: number, paint: SolidPaint | GradientPaint): void {
  const property = kind === 'fill' ? 'fills' : 'strokes';
  const paints = component[property];
  const current = paints[index];

  if (!current || current.type === spec.FillType.Texture) {
    throw new Error('The selected color paint does not exist.');
  }
  if (paint.type === spec.FillType.Solid) {
    const { r, g, b, a } = paint.color;

    if (![r, g, b, a].every(Number.isFinite)) {
      throw new Error('Invalid paint color.');
    }
  } else if (!isValidGradientPaint(paint)) {
    throw new Error('Invalid gradient paint.');
  }
  const nextPaints = paints.slice();

  nextPaints[index] = cloneColorPaint(paint);
  component[property] = nextPaints;
}

export function setGradientPaint (component: ShapeComponent, kind: PaintKind, index: number, paint: GradientPaint): void {
  const paints = kind === 'fill' ? component.fills : component.strokes;
  const current = paints[index];

  if (!current || current.type === spec.FillType.Solid || current.type === spec.FillType.Texture) {
    throw new Error('The selected paint is not a gradient.');
  }
  setColorPaint(component, kind, index, paint);
}

/** 与渐变 UV 一致的二维渲染边界；没有可绘制几何时不显示编辑手柄。 */
export function getShapeRenderBounds (component: ShapeComponent | undefined): { min: math.Vector2, max: math.Vector2 } | undefined {
  const bounds = component?.getRenderBounds();

  if (!bounds || bounds.isEmpty()) {
    return undefined;
  }

  return {
    min: new math.Vector2(bounds.min.x, bounds.min.y),
    max: new math.Vector2(bounds.max.x, bounds.max.y),
  };
}
