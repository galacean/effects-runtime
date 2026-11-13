import * as spec from '@galacean/effects-specification';
import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { ItemRenderer } from '../../components/base-render-component';
import type { Engine } from '../../engine';
import { Material, getPreMultiAlpha, setBlendMode, setSideMode } from '../../material';
import { createValueGetter, type GradientValue } from '../../math';
import { GLSLVersion } from '../../render';
import type { Texture } from '../../texture/texture';
import vert from './shaders/shape.vert.glsl';
import frag from './shaders/shape.frag.glsl';

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

/** 将序列化数据转换成 Shape 和 Frame 共用的运行时 Paint。 */
export function createPaint (paintData: spec.PaintData, findTexture: (path: spec.DataPath) => Texture): Paint {
  switch (paintData.type) {
    case spec.FillType.Solid:
      return { type: paintData.type, color: new Color().copyFrom(paintData.color) };
    case spec.FillType.GradientLinear:
    case spec.FillType.GradientAngular:
    case spec.FillType.GradientRadial:
      return {
        type: paintData.type,
        gradientStops: createValueGetter(paintData.gradientStops) as GradientValue,
        startPoint: new Vector2().copyFrom(paintData.startPoint),
        endPoint: new Vector2().copyFrom(paintData.endPoint),
      };
    case spec.FillType.Texture: {
      const transform = paintData.textureTransform;

      return {
        type: paintData.type,
        texture: findTexture(paintData.texture),
        scaleMode: paintData.scaleMode,
        scalingFactor: paintData.scalingFactor ?? 1,
        opacity: paintData.opacity ?? 1,
        textureTransform: {
          offset: new Vector2().copyFrom(transform?.offset ?? { x: 0, y: 0 }),
          rotation: transform?.rotation ?? 0,
          scale: new Vector2().copyFrom(transform?.scale ?? { x: 1, y: 1 }),
        },
      };
    }
  }
}

/** 更新 Paint 的统一材质参数；目标尺寸只用于纹理的缩放模式。 */
export function updatePaintMaterial (material: Material, paint: Paint, destSize: Vector2): void {
  material.setFloat('_FillType', paint.type);
  if (paint.type === spec.FillType.Solid) {
    material.color = paint.color;
  } else if (paint.type === spec.FillType.Texture) {
    material.setInt('_ImageScaleMode', paint.scaleMode);
    material.setVector2('_ImageSize', new Vector2(paint.texture.getWidth(), paint.texture.getHeight()));
    material.setVector2('_DestSize', destSize);
    material.setFloat('_ImageOpacity', paint.opacity);
    material.setFloat('_ImageScalingFactor', paint.scalingFactor);
    material.setTexture('_ImageTex', paint.texture);
    const transform = paint.textureTransform;

    material.setMatrix3('_TextureTransform', new Matrix3()
      .scale(transform.scale.x, transform.scale.y)
      .rotate(transform.rotation)
      .translate(transform.offset.x, transform.offset.y)
      .invert());
  } else {
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

/** Shape 和 Frame 使用同一套着色器、混合与材质创建逻辑。 */
export function createPaintMaterial (engine: Engine, rendererOptions?: ItemRenderer, alphaMaskEnabled = false): Material {
  const renderer = rendererOptions ?? {
    renderMode: spec.RenderMode.MESH,
    blending: spec.BlendingMode.ALPHA,
    texture: engine.assetServer.whiteTexture,
    occlusion: false,
    transparentOcclusion: false,
    side: spec.SideMode.DOUBLE,
    mask: 0,
  };
  const material = Material.create(engine, {
    shader: { vertex: vert, fragment: frag, glslVersion: GLSLVersion.GLSL1 },
  });

  material.shader.shaderData.properties = '_ImageTex("_ImageTex",2D) = "white" {}';
  applyPaintRendererOptions(material, renderer, alphaMaskEnabled);

  return material;
}

/** Apply renderer state when creating or reusing a paint material. */
export function applyPaintRendererOptions (material: Material, renderer: ItemRenderer, alphaMaskEnabled = false): void {
  const { side, occlusion, blending: blendMode, texture } = renderer;

  material.blending = true;
  material.depthTest = true;
  material.depthMask = occlusion;
  setBlendMode(material, blendMode);
  setSideMode(material, side);
  material.setVector4('_TexOffset', new Vector4(0, 0, 1, 1));
  material.setTexture('_ImageTex', texture);
  const texParams = new Vector4();

  texParams.x = renderer.occlusion ? +renderer.transparentOcclusion : 1;
  texParams.y = getPreMultiAlpha(blendMode);
  texParams.z = renderer.renderMode;
  material.setVector4('_TexParams', texParams);
  if (texParams.x === 0 || alphaMaskEnabled) {
    material.enableMacro('ALPHA_CLIP');
  } else {
    material.disableMacro('ALPHA_CLIP');
  }
}
