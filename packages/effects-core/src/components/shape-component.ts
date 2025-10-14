import { Color } from '@galacean/effects-math/es/core/color';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import type { Maskable, MaterialProps } from '../material';
import { MaskMode, MaskProcessor, getPreMultiAlpha, setBlendMode, setSideMode } from '../material';
import { Material, setMaskMode } from '../material';
import type { BoundingBoxTriangle, HitTestTriangleParams, Polygon, ShapePath, StrokeAttributes } from '../plugins';
import { MeshCollider } from '../plugins';
import { GraphicsPath, StarType, buildLine } from '../plugins';
import type { Renderer } from '../render';
import { GLSLVersion, Geometry } from '../render';
import type { GradientValue } from '../math';
import { createValueGetter } from '../math';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { RendererComponent } from './renderer-component';
import type { Texture } from '../texture/texture';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import vert from '../plugins/shape/shaders/shape.vert.glsl';
import frag from '../plugins/shape/shaders/shape.frag.glsl';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import type { ItemRenderer } from './base-render-component';

type Paint = SolidPaint | GradientPaint | TexturePaint;

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

interface ShapeAttributes {
  /**
   * 矢量图形类型
   */
  type: spec.ShapePrimitiveType,
}

/**
 * 自定义图形参数
 */
interface CustomShapeAttribute extends ShapeAttributes {
  type: spec.ShapePrimitiveType.Custom,
  /**
   * 路径点
   */
  points: Vector2[],
  /**
   * 入射控制点
   */
  easingIns: Vector2[],
  /**
   * 入射控制点
   */
  easingOuts: Vector2[],
  /**
   * 自定义形状
   */
  shapes: spec.CustomShape[],
}

/**
 * 椭圆组件参数
 */
export interface EllipseAttribute extends ShapeAttributes {
  type: spec.ShapePrimitiveType.Ellipse,
  /**
   * x 轴半径
   * -- TODO 后续完善类型
   * -- TODO 可以看一下用xRadius/yRadius 还是 width/height
   */
  xRadius: number,
  /**
   * y 轴半径
   */
  yRadius: number,
}

/**
 * 矩形参数
 */
export interface RectangleAttribute extends ShapeAttributes {
  /**
   * 宽度
   */
  width: number,
  /**
   * 高度
   */
  height: number,
  /**
   * 角点元素
   */
  roundness: number,
}

/**
 * 星形参数
 */
export interface StarAttribute extends ShapeAttributes {
  /**
   * 顶点数 - 内外顶点同数
   */
  pointCount: number,
  /**
   * 内径
   */
  innerRadius: number,
  /**
   * 外径
   */
  outerRadius: number,
  /**
   * 内径点圆度
   */
  innerRoundness: number,
  /**
   * 外径点圆度
   */
  outerRoundness: number,
}

/**
 * 多边形参数
 */
export interface PolygonAttribute extends ShapeAttributes {
  /**
   * 顶点数
   */
  pointCount: number,
  /**
   * 外切圆半径
   */
  radius: number,
  /**
   * 角点圆度
   */
  roundness: number,
}

/**
 * 图形组件
 * @since 2.1.0
 */
@effectsClass('ShapeComponent')
export class ShapeComponent extends RendererComponent implements Maskable {
  private shapeDirty = true;
  private materialDirty = true;
  private graphicsPath = new GraphicsPath();

  private fills: Paint[] = [];
  private strokeAttributes: StrokeAttributes = {
    width: 1,
    alignment: 0.5,
    cap: spec.LineCap.Butt,
    join: spec.LineJoin.Miter,
    miterLimit: 10,
  };

  private strokeWidth = 1;
  private strokeCap = spec.LineCap.Butt;
  private strokeJoin = spec.LineJoin.Miter;
  private strokes: Paint[] = [];
  private shapeAttributes: ShapeAttributes;

  /**
   * 用于点击测试的碰撞器
   */
  private meshCollider = new MeshCollider();
  private rendererOptions: ItemRenderer;
  private geometry: Geometry;
  private fillMaterials: Material[] = [];
  private strokeMaterials: Material[] = [];
  private readonly maskManager: MaskProcessor;

  get shape () {
    return this.shapeAttributes;
  }

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    this.rendererOptions = {
      renderMode: spec.RenderMode.MESH,
      blending: spec.BlendingMode.ALPHA,
      texture: this.engine.whiteTexture,
      occlusion: false,
      transparentOcclusion: false,
      side: spec.SideMode.DOUBLE,
      mask: 0,
    };

    this.maskManager = new MaskProcessor(this.engine);

    // Create Shape Attrributes
    //-------------------------------------------------------------------------

    const gradientStrokeFill: SolidPaint = {
      type: spec.FillType.Solid,
      color: new Color(1, 1, 1, 1),
    };

    this.strokes.push(gradientStrokeFill);

    const gradientLayerFill: SolidPaint = {
      type: spec.FillType.Solid,
      color: new Color(1, 1, 1, 1),
    };

    this.fills.push(gradientLayerFill);

    this.shapeAttributes = {
      type: spec.ShapePrimitiveType.Custom,
      points: [],
      easingIns: [],
      easingOuts: [],
      shapes: [],
    } as CustomShapeAttribute;

    // Create Geometry
    //-------------------------------------------------------------------------

    this.geometry = Geometry.create(this.engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array([
            -0.5, 0.5, 0, //左上
            -0.5, -0.5, 0, //左下
            0.5, 0.5, 0, //右上
            0.5, -0.5, 0, //右下
          ]),
        },
        aUV: {
          size: 2,
          offset: 0,
          releasable: true,
          type: glContext.FLOAT,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]), releasable: true },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });

    this.geometry.subMeshes.push({
      offset: 0,
      indexCount: 0,
      vertexCount: 0,
    }, {
      offset: 0,
      indexCount: 0,
      vertexCount: 0,
    });
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    if (this.shapeDirty) {
      this.buildPath(this.shapeAttributes);
      this.buildGeometryFromPath(this.graphicsPath.shapePath);
      this.shapeDirty = false;
    }

    if (this.materialDirty) {
      this.updateMaterials();
      this.materialDirty = false;
    }
  }

  override render (renderer: Renderer) {
    this.maskManager.drawStencilMask(renderer);

    this.draw(renderer);
  }

  /**
   * @internal
   */
  drawStencilMask (renderer: Renderer) {
    if (!this.isActiveAndEnabled) {
      return;
    }
    const previousColorMask0 = this.material.colorMask;
    const previousColorMask1 = this.materials[1].colorMask;

    this.material.colorMask = false;
    this.materials[1].colorMask = false;
    this.draw(renderer);
    this.material.colorMask = previousColorMask0;
    this.materials[1].colorMask = previousColorMask1;
  }

  private draw (renderer: Renderer) {
    for (let i = 0; i < this.fillMaterials.length; i++) {
      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.fillMaterials[i], 0);
    }

    for (let i = 0; i < this.strokeMaterials.length; i++) {
      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), this.strokeMaterials[i], 1);
    }
  }

  getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
    const sizeMatrix = Matrix4.fromScale(this.transform.size.x, this.transform.size.y, 1);
    const worldMatrix = sizeMatrix.premultiply(this.transform.getWorldMatrix());

    if (force) {
      this.meshCollider.setGeometry(this.geometry, worldMatrix);
      const area = this.meshCollider.getBoundingBoxData();

      if (area) {
        return {
          behavior: 0,
          type: area.type,
          triangles: area.area,
          backfaceCulling: this.rendererOptions.side === spec.SideMode.FRONT,
        };
      }
    }
  };

  getBoundingBox (): BoundingBoxTriangle {
    const worldMatrix = this.transform.getWorldMatrix();

    this.meshCollider.setGeometry(this.geometry, worldMatrix);
    const boundingBox = this.meshCollider.getBoundingBox();

    return boundingBox;
  }

  private buildGeometryFromPath (shapePath: ShapePath) {
    const shapePrimitives = shapePath.shapePrimitives;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Triangulate shapePrimitives, build fill and stroke shape geometry
    if (this.fills.length > 0) {
      for (const shapePrimitive of shapePrimitives) {
        const shape = shapePrimitive.shape;
        const points: number[] = [];
        const indexOffset = indices.length;
        const vertOffset = vertices.length / 2;

        shape.build(points);
        shape.triangulate(points, vertices, vertOffset, indices, indexOffset);
      }
    }

    const fillIndexCount = indices.length;

    if (this.strokes.length > 0) {
      for (const shapePrimitive of shapePrimitives) {
        const shape = shapePrimitive.shape;
        const points: number[] = [];
        const indexOffset = indices.length;
        const vertOffset = vertices.length / 2;
        const lineStyle = this.strokeAttributes;

        lineStyle.cap = this.strokeCap;
        lineStyle.join = this.strokeJoin;
        lineStyle.width = this.strokeWidth;

        let close = true;

        if (this.shapeAttributes.type === spec.ShapePrimitiveType.Custom) {
          close = (shape as Polygon).closePath;
        }

        shape.build(points);
        buildLine(points, lineStyle, false, close, vertices, 2, vertOffset, indices, indexOffset);
      }
    }

    const strokeIndexCount = indices.length - fillIndexCount;
    const vertexCount = vertices.length / 2;

    // Get the current attribute and index arrays from the geometry, avoiding re-creation
    let positionArray = this.geometry.getAttributeData('aPos');
    let uvArray = this.geometry.getAttributeData('aUV');
    let indexArray = this.geometry.getIndexData();

    if (!positionArray || positionArray.length < vertexCount * 3) {
      positionArray = new Float32Array(vertexCount * 3);
    }

    if (!uvArray || uvArray.length < vertexCount * 2) {
      uvArray = new Float32Array(vertexCount * 2);
    }

    if (!indexArray || indexArray.length < indices.length) {
      indexArray = new Uint16Array(indices.length);
    }

    // Set position attribute array, calculate bounding box for uv scaling
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;

    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const positionArrayOffset = i * 2;

      const x = vertices[positionArrayOffset];
      const y = vertices[positionArrayOffset + 1];

      positionArray[pointsOffset] = x;
      positionArray[pointsOffset + 1] = y;
      positionArray[pointsOffset + 2] = 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    // Set uv attribute array
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;

    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const uvOffset = i * 2;

      uvArray[uvOffset] = (positionArray[pointsOffset] - minX) / sizeX;
      uvArray[uvOffset + 1] = (positionArray[pointsOffset + 1] - minY) / sizeY;
    }

    // Set index array
    indexArray.set(indices);

    // Rewrite to geometry
    this.geometry.setAttributeData('aPos', positionArray);
    this.geometry.setAttributeData('aUV', uvArray);
    this.geometry.setIndexData(indexArray);
    this.geometry.setDrawCount(indices.length);

    const u16Size = 2;
    const fillSubMesh = this.geometry.subMeshes[0];
    const strokeSubMesh = this.geometry.subMeshes[1];

    fillSubMesh.indexCount = fillIndexCount;
    strokeSubMesh.offset = fillIndexCount * u16Size;
    strokeSubMesh.indexCount = strokeIndexCount;
  }

  private buildPath (shapeAttribute: ShapeAttributes) {
    this.graphicsPath.clear();

    switch (shapeAttribute.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customShapeAtribute = this.shapeAttributes as CustomShapeAttribute;
        const points = customShapeAtribute.points;
        const easingIns = customShapeAtribute.easingIns;
        const easingOuts = customShapeAtribute.easingOuts;

        for (const shape of customShapeAtribute.shapes) {
          const indices = shape.indexes;
          const startPoint = points[indices[0].point];

          this.graphicsPath.moveTo(startPoint.x, startPoint.y);

          for (let i = 1; i < indices.length; i++) {
            const pointIndex = indices[i];
            const lastPointIndex = indices[i - 1];
            const point = points[pointIndex.point];
            const lastPoint = points[lastPointIndex.point];
            const control1 = easingOuts[lastPointIndex.easingOut];
            const control2 = easingIns[pointIndex.easingIn];

            this.graphicsPath.bezierCurveTo(control1.x + lastPoint.x, control1.y + lastPoint.y, control2.x + point.x, control2.y + point.y, point.x, point.y, 1);
          }

          if (shape.close) {
            const pointIndex = indices[0];
            const lastPointIndex = indices[indices.length - 1];
            const point = points[pointIndex.point];
            const lastPoint = points[lastPointIndex.point];
            const control1 = easingOuts[lastPointIndex.easingOut];
            const control2 = easingIns[pointIndex.easingIn];

            this.graphicsPath.bezierCurveTo(control1.x + lastPoint.x, control1.y + lastPoint.y, control2.x + point.x, control2.y + point.y, point.x, point.y, 1);
            this.graphicsPath.closePath();
          }
        }

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = shapeAttribute as EllipseAttribute;

        this.graphicsPath.ellipse(0, 0, ellipseData.xRadius, ellipseData.yRadius);

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = shapeAttribute as RectangleAttribute;

        this.graphicsPath.rect(-rectangleData.width / 2, -rectangleData.height / 2, rectangleData.width, rectangleData.height, rectangleData.roundness);

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const starData = shapeAttribute as StarAttribute;

        this.graphicsPath.polyStar(starData.pointCount, starData.outerRadius, starData.innerRadius, starData.outerRoundness, starData.innerRoundness, StarType.Star);

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = shapeAttribute as PolygonAttribute;

        this.graphicsPath.polyStar(polygonData.pointCount, polygonData.radius, polygonData.radius, polygonData.roundness, polygonData.roundness, StarType.Polygon);

        break;
      }
    }
  }

  private updateMaterials () {
    for (let i = 0; i < this.fills.length; i++) {
      this.updatePaintMaterial(this.fillMaterials[i], this.fills[i]);
    }

    for (let i = 0; i < this.strokes.length; i++) {
      this.updatePaintMaterial(this.strokeMaterials[i], this.strokes[i]);
    }
  }

  private updatePaintMaterial (material: Material, paint: Paint) {
    material.setFloat('_FillType', paint.type);

    if (paint.type === spec.FillType.Solid) {
      material.color = paint.color;
    } else if (paint.type === spec.FillType.GradientLinear || paint.type === spec.FillType.GradientAngular || paint.type === spec.FillType.GradientRadial) {
      this.updateGradientMaterial(material, paint.gradientStops, paint.startPoint, paint.endPoint);
    } else if (paint.type === spec.FillType.Texture) {
      material.setInt('_ImageScaleMode', paint.scaleMode);
      material.setVector2('_ImageSize', new Vector2(paint.texture.getWidth(), paint.texture.getHeight()));

      const boundingBox = this.getBoundingBox();
      const topRight = boundingBox.area[0].p1;
      const bottomLeft = boundingBox.area[1].p2;

      material.setVector2('_DestSize', new Vector2(topRight.x - bottomLeft.x, topRight.y - bottomLeft.y));
      material.setFloat('_ImageOpacity', paint.opacity);
      material.setFloat('_ImageScalingFactor', paint.scalingFactor);
      material.setTexture('_ImageTex', paint.texture);

      const transform = paint.textureTransform;

      material.setMatrix3('_TextureTransform', new Matrix3()
        .scale(transform.scale.x, transform.scale.y)
        .rotate(transform.rotation)
        .translate(transform.offset.x, transform.offset.y)
        .invert()
      );
    }
  }

  private updateGradientMaterial (material: Material, gradient: GradientValue, startPoint: Vector2, endPoint: Vector2) {
    const gradientColors: Vector4[] = [];
    const gradientStops: number[] = [];

    for (const stop of gradient.stops) {
      const stopColor = stop.color;

      gradientColors.push(new Vector4(stopColor.r, stopColor.g, stopColor.b, stopColor.a));
      gradientStops.push(stop.time);
    }

    material.setVector4Array('_Colors', gradientColors);
    material.setFloats('_Stops', gradientStops);
    material.setInt('_StopsCount', gradientStops.length);
    material.setVector2('_StartPoint', startPoint);
    material.setVector2('_EndPoint', endPoint);
  }

  private createMaterialFromRendererOptions (rendererOptions: ItemRenderer): Material {
    const materialProps: MaterialProps = {
      shader: {
        vertex: vert,
        fragment: frag,
        glslVersion: GLSLVersion.GLSL1,
      },
    };
    const material = Material.create(this.engine, materialProps);

    const renderer = rendererOptions;
    const { side, occlusion, blending: blendMode, mask, texture } = renderer;
    const maskMode = this.maskManager.maskMode;

    material.blending = true;
    material.depthTest = true;
    material.depthMask = occlusion;
    material.stencilRef = mask !== undefined ? [mask, mask] : undefined;

    setBlendMode(material, blendMode);
    // 兼容旧数据中模板需要渲染的情况
    setMaskMode(material, maskMode);
    setSideMode(material, side);

    material.shader.shaderData.properties = '_MainTex("_MainTex",2D) = "white" {}';
    material.setVector4('_TexOffset', new Vector4(0, 0, 1, 1));
    material.setTexture('_ImageTex', texture);

    const preMultiAlpha = getPreMultiAlpha(blendMode);
    const texParams = new Vector4();

    texParams.x = renderer.occlusion ? +(renderer.transparentOcclusion) : 1;
    texParams.y = preMultiAlpha;
    texParams.z = renderer.renderMode;
    texParams.w = maskMode;
    material.setVector4('_TexParams', texParams);

    if (texParams.x === 0 || (this.maskManager.alphaMaskEnabled)) {
      material.enableMacro('ALPHA_CLIP');
    } else {
      material.disableMacro('ALPHA_CLIP');
    }

    return material;
  }

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.shapeDirty = true;

    if (data.mask) {
      this.maskManager.setMaskOptions(data.mask);
    }

    const renderer = data.renderer ?? {};

    this.rendererOptions = {
      renderMode: renderer.renderMode ?? spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ? this.engine.findObject<Texture>(renderer.texture) : this.engine.whiteTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (this.maskManager.maskMode === MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: this.maskManager.getRefValue(),
    };

    this.strokeCap = data.strokeCap ?? spec.LineCap.Butt;
    this.strokeWidth = data.strokeWidth ?? 1;
    this.strokeJoin = data.strokeJoin ?? spec.LineJoin.Miter;

    this.fills.length = 0;
    this.fillMaterials.length = 0;
    for (const fill of data.fills) {
      this.fills.push(this.createPaint(fill));
      this.fillMaterials.push(this.createMaterialFromRendererOptions(this.rendererOptions));
    }

    this.strokes.length = 0;
    this.strokeMaterials.length = 0;
    for (const stroke of data.strokes) {
      this.strokes.push(this.createPaint(stroke));
      this.strokeMaterials.push(this.createMaterialFromRendererOptions(this.rendererOptions));
    }

    this.materials = [...this.fillMaterials, ...this.strokeMaterials];

    switch (data.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customShapeData = data as spec.CustomShapeData;
        const customShapeAttribute: CustomShapeAttribute = {
          type: spec.ShapePrimitiveType.Custom,
          points: [],
          easingIns: [],
          easingOuts: [],
          shapes: [],
        };

        for (const point of customShapeData.points) {
          customShapeAttribute.points.push(new Vector2(point.x, point.y));
        }
        for (const easingIn of customShapeData.easingIns) {
          customShapeAttribute.easingIns.push(new Vector2(easingIn.x, easingIn.y));
        }
        for (const easingOut of customShapeData.easingOuts) {
          customShapeAttribute.easingOuts.push(new Vector2(easingOut.x, easingOut.y));
        }
        customShapeAttribute.shapes = customShapeData.shapes;

        this.shapeAttributes = customShapeAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = data as spec.EllipseData;
        const ellipseAttribute: EllipseAttribute = {
          type: spec.ShapePrimitiveType.Ellipse,
          xRadius: ellipseData.xRadius,
          yRadius: ellipseData.yRadius,
        };

        this.shapeAttributes = ellipseAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = data as spec.RectangleData;
        const rectangleAttribute: RectangleAttribute = {
          type: spec.ShapePrimitiveType.Rectangle,
          width: rectangleData.width,
          height: rectangleData.height,
          roundness: rectangleData.roundness,
        };

        this.shapeAttributes = rectangleAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const starData = data as spec.StarData;
        const starAttribute: StarAttribute = {
          type: spec.ShapePrimitiveType.Star,
          pointCount: starData.pointCount,
          innerRadius: starData.innerRadius,
          outerRadius: starData.outerRadius,
          innerRoundness: starData.innerRoundness,
          outerRoundness: starData.outerRoundness,
        };

        this.shapeAttributes = starAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = data as spec.PolygonData;
        const polygonAttribute: PolygonAttribute = {
          type: spec.ShapePrimitiveType.Polygon,
          pointCount: polygonData.pointCount,
          radius: polygonData.radius,
          roundness: polygonData.roundness,
        };

        this.shapeAttributes = polygonAttribute;

        break;
      }
    }
  }

  private createPaint (paintData: spec.PaintData): Paint {
    let paint: Paint;

    switch (paintData.type) {
      case spec.FillType.Solid: {
        paint = {
          type: paintData.type,
          color: new Color().copyFrom(paintData.color),
        };

        break;
      }
      case spec.FillType.GradientLinear:
      case spec.FillType.GradientAngular:
      case spec.FillType.GradientRadial: {
        paint = {
          type: paintData.type,
          gradientStops: createValueGetter(paintData.gradientStops) as GradientValue,
          startPoint: new Vector2().copyFrom(paintData.startPoint),
          endPoint: new Vector2().copyFrom(paintData.endPoint),
        };

        break;
      }
      case spec.FillType.Texture: {

        const textureTransform = {
          offset: { x: 0, y: 0 },
          rotation: 0,
          scale: { x: 1, y: 1 },
          //@ts-expect-error
          ...(paintData.textureTransform ?? {}),
        };

        paint = {
          type: paintData.type,
          texture: this.engine.findObject<Texture>(paintData.texture),
          scaleMode: paintData.scaleMode,
          scalingFactor: paintData.scalingFactor ?? 1,
          opacity: paintData.opacity ?? 1,
          textureTransform: {
            offset: new Vector2().copyFrom(textureTransform.offset),
            rotation: textureTransform.rotation,
            scale: new Vector2().copyFrom(textureTransform.scale),
          },
        };

        break;
      }
    }

    return paint;
  }

  override onApplyAnimationProperties (): void {
    this.shapeDirty = true;
    this.materialDirty = true;
  }
}