import type { Color } from '@galacean/effects-math/es/core/color';
import type { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import * as spec from '@galacean/effects-specification';
import type { ItemRenderer } from '../../components';
import type { GradientValue } from '../../math';
import type { Material } from '../../material';
import { setBlendMode, setSideMode } from '../../material';
import type { Texture } from '../../texture';

export type Paint = SolidPaint | GradientPaint | TexturePaint;

export interface SolidPaint {
  type: spec.FillType.Solid,
  color: Color,
}

export interface GradientPaint {
  type: spec.FillType.GradientLinear | spec.FillType.GradientAngular | spec.FillType.GradientRadial,
  gradientStops: GradientValue,
  startPoint: Vector2,
  endPoint: Vector2,
}

export interface TextureTransform {
  offset: Vector2,
  rotation: number,
  scale: Vector2,
}

export interface TexturePaint {
  type: spec.FillType.Texture,
  texture: Texture,
  scaleMode: TexturePaintScaleMode,
  scalingFactor: number,
  opacity: number,
  textureTransform: TextureTransform,
}

export enum TexturePaintScaleMode {
  Fill,
  Fit,
  Crop,
  Tile
}

export function isSolidOrGradient (paint: Paint): paint is SolidPaint | GradientPaint {
  return paint.type === spec.FillType.Solid
    || paint.type === spec.FillType.GradientLinear
    || paint.type === spec.FillType.GradientAngular
    || paint.type === spec.FillType.GradientRadial;
}

/** 更新 paint 类型、纯色和渐变参数；纹理变换由使用方设置。 */
export function updateShapePaintMaterial (material: Material, paint: Paint): void {
  material.setFloat('_FillType', paint.type);

  if (paint.type === spec.FillType.Solid) {
    material.color = paint.color;
  } else if (isSolidOrGradient(paint)) {
    const colors: Vector4[] = [];
    const stops: number[] = [];

    for (const stop of paint.gradientStops.stops) {
      const color = stop.color;

      colors.push(new Vector4(color.r, color.g, color.b, color.a));
      stops.push(stop.time);
    }

    material.setVector4Array('_Colors', colors);
    material.setFloats('_Stops', stops);
    material.setInt('_StopsCount', stops.length);
    material.setVector2('_StartPoint', paint.startPoint);
    material.setVector2('_EndPoint', paint.endPoint);
  }
}

export function applyShapeRendererOptions (material: Material, renderer: ItemRenderer): void {
  material.blending = true;
  material.depthTest = true;
  material.depthMask = renderer.occlusion;
  setBlendMode(material, renderer.blending);
  setSideMode(material, renderer.side);
}
