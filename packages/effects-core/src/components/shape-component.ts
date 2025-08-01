import { Color } from '@galacean/effects-math/es/core/color';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import type { Maskable, MaterialProps } from '../material';
import { MaskMode, MaskProcessor, getPreMultiAlpha, setBlendMode, setSideMode } from '../material';
import { Material, setMaskMode } from '../material';
import type { BoundingBoxTriangle, HitTestTriangleParams, Polygon, ShapePath, StrokeAttributes } from '../plugins';
import { FillType, MeshCollider } from '../plugins';
import { GraphicsPath, StarType, buildLine } from '../plugins';
import type { Renderer } from '../render';
import { GLSLVersion, Geometry } from '../render';
import type { ItemRenderer } from './base-render-component';
import { GradientValue, createValueGetter } from '../math';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { RendererComponent } from './renderer-component';
import type { Texture } from '../texture/texture';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';

interface FillAttributes {
  fillType: FillType,
  color: Color,
  gradient: GradientValue,
  startPoint: Vector2,
  endPoint: Vector2,
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
  private hasStroke = false;
  private hasFill = false;
  private shapeDirty = true;
  private graphicsPath = new GraphicsPath();

  private fills: FillAttributes[] = [];
  private strokes: StrokeAttributes[] = [];
  private shapeAttributes: ShapeAttributes;

  /**
   * 用于点击测试的碰撞器
   */
  private meshCollider = new MeshCollider();
  private renderer: ItemRenderer;
  private geometry: Geometry;
  private readonly maskManager: MaskProcessor;

  private vert = `
precision highp float;

attribute vec3 aPos;//x y
attribute vec2 aUV;//x y

varying vec2 uv0;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;

void main() {
  vec4 pos = vec4(aPos.xyz, 1.0);
  uv0 = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
}
`;

  private frag = `
precision highp float;
#define _MAX_STOPS 8
#define PI 3.14159265359

uniform vec4 _Color;                   // 纯色
uniform vec4 _Colors[_MAX_STOPS];      // 渐变颜色数组
uniform float _Stops[_MAX_STOPS];      // 渐变控制点位置数组
uniform int _StopsCount;               // 实际使用的渐变控制点数量
uniform float _FillType;               // 填充类型 (0:solid, 1:linear, 2:radial, 3:angular)
uniform vec2 _StartPoint;              // 渐变起点 (0-1范围)
uniform vec2 _EndPoint;                // 渐变终点 (0-1范围)

varying vec2 uv0;

// 辅助函数：在两点之间进行平滑插值
vec4 smoothMix(vec4 a, vec4 b, float t) {
    return mix(a, b, smoothstep(0.0, 1.0, t));
}

// 计算向量的角度 (返回0到1之间的值)
float calculateAngleRatio(vec2 v1, vec2 v2) {
    float angle = atan(v2.y, v2.x) - atan(v1.y, v1.x);
    // 确保角度在0到2PI之间
    if (angle < 0.0) angle += 2.0 * PI;
    return angle / (2.0 * PI);
}

void main() {
    vec4 finalColor = vec4(1.0);

    if(_FillType == 0.0) {
        // 纯色填充
        finalColor = _Color;
    } else {
        float t = 0.0;

        if(_FillType == 1.0) {
            // 线性渐变
            vec2 gradientVector = _EndPoint - _StartPoint;
            vec2 pixelVector = uv0 - _StartPoint;
            t = dot(pixelVector, gradientVector) / dot(gradientVector, gradientVector);
            t = clamp(t, 0.0, 1.0);
        } else if(_FillType == 2.0) {
            // 径向渐变
            float maxRadius = distance(_EndPoint, _StartPoint);
            maxRadius = max(maxRadius, 0.001);
            t = distance(uv0, _StartPoint) / maxRadius;
            t = clamp(t, 0.0, 1.0);
        } else if(_FillType == 3.0) {
            // 角度渐变
            vec2 center = _StartPoint;
            vec2 referenceVector = _EndPoint - center;
            vec2 targetVector = uv0 - center;
            
            // 忽略太接近中心点的像素以避免精度问题
            if (length(targetVector) > 0.001) {
                t = calculateAngleRatio(referenceVector, targetVector);
            }
        }

        // 找到对应的渐变区间
        finalColor = _Colors[0];
        
        for(int i = 1; i < _MAX_STOPS; i++) {
            if(i >= _StopsCount)
                break;

            float prevStop = _Stops[i - 1];
            float currStop = _Stops[i];

            if(t >= prevStop && t <= currStop) {
                float localT = (t - prevStop) / (currStop - prevStop);
                finalColor = smoothMix(_Colors[i - 1], _Colors[i], localT);
                break;
            }
        }
    }

    gl_FragColor = finalColor;
}
`;

  get shape () {
    this.shapeDirty = true;

    return this.shapeAttributes;
  }

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    this.renderer = {
      renderMode: spec.RenderMode.MESH,
      blending: spec.BlendingMode.ALPHA,
      texture: this.engine.emptyTexture,
      occlusion: false,
      transparentOcclusion: false,
      side: spec.SideMode.DOUBLE,
      mask: 0,
    };

    this.maskManager = new MaskProcessor(this.engine);

    // Create Shape Attrributes
    //-------------------------------------------------------------------------

    this.strokes.push({
      width: 1,
      alignment: 0.5,
      cap: spec.LineCap.Butt,
      join: spec.LineJoin.Miter,
      miterLimit: 10,
      color: new Color(0.25, 0.25, 0.25, 1),
      strokeType: FillType.Solid,
      gradient: new GradientValue([
        [0, 1, 1, 0, 1],
        [1, 0, 0, 1, 1],
      ]),
      startPoint: new Vector2(0, 0),
      endPoint: new Vector2(1, 0),
    });

    this.fills.push({
      color: new Color(1, 1, 1, 1),
      gradient: new GradientValue([
        [0, 0.2, 0.2, 0.8, 1],
        [0.3, 1, 1, 0, 1],
        [1, 1, 0.2, 0.2, 1],
      ]),
      fillType: FillType.Solid,
      startPoint: new Vector2(0, 0),
      endPoint: new Vector2(1, 0),
    });

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

    // Create Material
    //-------------------------------------------------------------------------

    const materialProps: MaterialProps = {
      shader: {
        vertex: this.vert,
        fragment: this.frag,
        glslVersion: GLSLVersion.GLSL1,
      },
    };

    const fillMaterial = Material.create(engine, materialProps);
    const strokeMaterial = Material.create(engine, materialProps);

    fillMaterial.depthMask = false;
    fillMaterial.depthTest = true;
    fillMaterial.blending = true;
    this.material = fillMaterial;

    strokeMaterial.depthMask = false;
    strokeMaterial.depthTest = true;
    strokeMaterial.blending = true;
    this.materials[1] = strokeMaterial;

    this.setupMaterials();
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
    const previousColorMask1 = this.material.colorMask;

    this.material.colorMask = false;
    this.materials[1].colorMask = false;
    this.draw(renderer);
    this.material.colorMask = previousColorMask0;
    this.materials[1].colorMask = previousColorMask1;
  }

  private draw (renderer: Renderer) {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i];

      renderer.drawGeometry(this.geometry, material, i);
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
          backfaceCulling: this.renderer.side === spec.SideMode.FRONT,
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
    if (this.hasFill) {
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

    if (this.hasStroke) {
      for (const shapePrimitive of shapePrimitives) {
        const shape = shapePrimitive.shape;
        const points: number[] = [];
        const indexOffset = indices.length;
        const vertOffset = vertices.length / 2;
        const lineStyle = this.strokes[0];

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

  private setupMaterials () {
    for (const material of this.materials) {
      const renderer = this.renderer;
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
      material.setTexture('_MainTex', texture);

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
    }

    const fill = this.fills[0];
    const stroke = this.strokes[0];

    this.material.color = fill.color;
    this.material.setFloat('_FillType', fill.fillType);

    this.materials[1].color = stroke.color;
    this.materials[1].setFloat('_FillType', stroke.strokeType);

    if (fill.fillType !== FillType.Solid) {
      this.setupGradientMaterial(this.material, fill.gradient, fill.startPoint, fill.endPoint);
    }

    if (stroke.strokeType !== FillType.Solid) {
      this.setupGradientMaterial(this.materials[1], stroke.gradient, stroke.startPoint, stroke.endPoint);
    }
  }

  private setupGradientMaterial (material: Material, gradient: GradientValue, startPoint: Vector2, endPoint: Vector2) {
    const gradientColors: Vector4[] = [];
    const gradientStops: number[] = [];

    for (const stop of gradient.stops) {
      const stopColor = stop.color;

      gradientColors.push(new Vector4(stopColor[0], stopColor[1], stopColor[2], stopColor[3]));
      gradientStops.push(stop.stop);
    }
    material.setVector4Array('_Colors', gradientColors);
    material.setFloats('_Stops', gradientStops);
    material.setInt('_StopsCount', gradientStops.length);
    material.setVector2('_StartPoint', startPoint);
    material.setVector2('_EndPoint', endPoint);
  }

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.shapeDirty = true;

    if (data.mask) {
      this.maskManager.setMaskOptions(data.mask);
    }

    //@ts-expect-error
    const renderer = data.renderer ?? {};

    this.renderer = {
      renderMode: renderer.renderMode ?? spec.RenderMode.MESH,
      blending: renderer.blending ?? spec.BlendingMode.ALPHA,
      texture: renderer.texture ? this.engine.findObject<Texture>(renderer.texture) : this.engine.emptyTexture,
      occlusion: !!renderer.occlusion,
      transparentOcclusion: !!renderer.transparentOcclusion || (this.maskManager.maskMode === MaskMode.MASK),
      side: renderer.side ?? spec.SideMode.DOUBLE,
      mask: this.maskManager.getRefValue(),
    };

    const strokeParam = data.stroke;

    if (strokeParam) {
      this.hasStroke = true;
      const stroke = this.strokes[0];

      stroke.width = strokeParam.width;
      stroke.cap = strokeParam.cap;
      stroke.join = strokeParam.join;

      stroke.color.copyFrom(strokeParam.color);

      //@ts-expect-error
      stroke.strokeType = strokeParam.strokeType ?? FillType.Solid;

      //@ts-expect-error
      if (strokeParam.gradient) {
        //@ts-expect-error
        stroke.gradient = createValueGetter(strokeParam.gradient);
      }

      //@ts-expect-error
      if (strokeParam.startPoint) {
        //@ts-expect-error
        stroke.startPoint.copyFrom(strokeParam.startPoint);
      }

      //@ts-expect-error
      if (strokeParam.endPoint) {
        //@ts-expect-error
        stroke.endPoint.copyFrom(strokeParam.endPoint);
      }
    }

    const fillParam = data.fill;

    if (fillParam) {
      this.hasFill = true;

      const fill = this.fills[0];

      fill.color.copyFrom(fillParam.color);
      //@ts-expect-error
      fill.fillType = fillParam.fillType ?? FillType.Solid;

      //@ts-expect-error
      if (fillParam.gradient) {
        //@ts-expect-error
        fill.gradient = createValueGetter(fillParam.gradient);
      }

      //@ts-expect-error
      if (fillParam.startPoint) {
        //@ts-expect-error
        fill.startPoint.copyFrom(fillParam.startPoint);
      }

      //@ts-expect-error
      if (fillParam.endPoint) {
        //@ts-expect-error
        fill.endPoint.copyFrom(fillParam.endPoint);
      }
    }

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

    this.setupMaterials();
  }
}

