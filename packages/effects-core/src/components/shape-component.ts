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
import type { ItemRenderer } from './base-render-component';
import type { GradientValue } from '../math';
import { createValueGetter } from '../math';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { RendererComponent } from './renderer-component';
import type { Texture } from '../texture/texture';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';

type Paint = SolidPaint | GradientPaint | TexturePaint;

export enum FillType {
  Solid,
  GradientLinear,
  GradientRadial,
  GradientAngular,
  Texture
}

export interface SolidPaint {
  type: FillType.Solid,
  color: Color,
}

export interface GradientPaint {
  type: FillType.GradientLinear | FillType.GradientAngular | FillType.GradientRadial,
  gradientStops: GradientValue,
  startPoint: Vector2,
  endPoint: Vector2,
}

export interface TexturePaint {
  type: FillType.Texture,
  texture: Texture,
  scaleMode: TexturePaintScaleMode,
  scalingFactor: number,
  opacity: number,
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
  private hasStroke = false;
  private hasFill = false;
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
  private strokes: Paint[] = [];
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
uniform float _FillType;               // 填充类型 (0:solid, 1:linear, 2:radial, 3:angular, 4:image)
uniform vec2 _StartPoint;              // 渐变起点 (0-1范围)
uniform vec2 _EndPoint;                // 渐变终点 (0-1范围)

uniform sampler2D _ImageTex;           // 图片纹理
uniform vec2 _ImageSize;               // 图片尺寸 (px)
uniform vec2 _DestSize;                // 目标区域尺寸 (px)
uniform int _ImageScaleMode;           // 图片缩放模式 (0:FILL 覆盖, 1:FIT 适应, 2:CROP 裁剪, 3:TILE 平铺)
uniform mat3 _ImageTransform;          // 图片UV变换矩阵
uniform float _ImageScalingFactor;     // 平铺缩放因子( 仅 _ImageScaleMode==3 生效), 1=一屏一张
uniform float _ImageOpacity;           // 图片不透明度 0..1

varying vec2 uv0;

// 辅助函数：在两点之间进行平滑插值
vec4 smoothMix(vec4 a, vec4 b, float t) {
    return mix(a, b, smoothstep(0.0, 1.0, t));
}

// 计算向量的角度 (返回0到1之间的值)
float calculateAngleRatio(vec2 v1, vec2 v2) {
    float angle = atan(v2.y, v2.x) - atan(v1.y, v1.x);
    if(angle < 0.0)
        angle += 2.0 * PI;
    return angle / (2.0 * PI);
}

// 应用2D变换到UV
vec2 applyTransform(mat3 m, vec2 uv) {
    vec3 p = m * vec3(uv, 1.0);
    return p.xy;
}

void main() {
    vec4 finalColor = vec4(1.0);

    if(_FillType == 0.0) {
        // 纯色填充
        finalColor = _Color;

    } else if(_FillType == 1.0 || _FillType == 2.0 || _FillType == 3.0) {
        // 渐变填充
        float t = 0.0;

        if(_FillType == 1.0) {
            // 线性渐变
            vec2 gradientVector = _EndPoint - _StartPoint;
            vec2 pixelVector = uv0 - _StartPoint;
            float denom = max(dot(gradientVector, gradientVector), 1e-6);
            t = clamp(dot(pixelVector, gradientVector) / denom, 0.0, 1.0);
        } else if(_FillType == 2.0) {
            // 径向渐变
            float maxRadius = max(distance(_EndPoint, _StartPoint), 0.001);
            t = clamp(distance(uv0, _StartPoint) / maxRadius, 0.0, 1.0);
        } else {
            // 角度渐变
            vec2 center = _StartPoint;
            vec2 referenceVector = _EndPoint - center;
            vec2 targetVector = uv0 - center;
            if(length(targetVector) > 0.001) {
                t = calculateAngleRatio(referenceVector, targetVector);
            }
        }

        // 渐变区间插值
        finalColor = _Colors[0];
        for(int i = 1; i < _MAX_STOPS; i++) {
            if(i >= _StopsCount)
                break;
            float prevStop = _Stops[i - 1];
            float currStop = _Stops[i];
            if(t >= prevStop && t <= currStop) {
                float localT = (t - prevStop) / max(currStop - prevStop, 1e-6);
                finalColor = smoothMix(_Colors[i - 1], _Colors[i], localT);
                break;
            }
        }

    } else if(_FillType == 4.0) {
        // 图片填充 (Image Paint)
        vec2 uv = uv0;

        // 计算宽高比
        float rSrc = _ImageSize.x / max(_ImageSize.y, 1.0);
        float rDst = _DestSize.x / max(_DestSize.y, 1.0);

        // 根据模式调整采样UV
        bool maskOutside = false;
        if(_ImageScaleMode == 0) {
            // FILL 覆盖（可能裁剪）
            vec2 scale = vec2(1.0);
            if(rDst > rSrc) {
                scale = vec2(1.0, rSrc / rDst);
            } else {
                scale = vec2(rDst / rSrc, 1.0);
            }
            uv = (uv - 0.5) * scale + 0.5;
            uv = clamp(uv, 0.0, 1.0);
        } else if(_ImageScaleMode == 1) {
            // FIT 适应（保留空白）
            vec2 scale = vec2(1.0);
            if(rDst > rSrc) {
                scale = vec2(rSrc / rDst, 1.0);
            } else {
                scale = vec2(1.0, rSrc / rDst);
            }
            uv = (uv - 0.5) * scale + 0.5;
            maskOutside = true;
        } else if(_ImageScaleMode == 2) {
            // CROP 指定裁剪矩形
            uv = applyTransform(_ImageTransform, uv0);
            maskOutside = true;
        } else if(_ImageScaleMode == 3) {
          // TILE 平铺(保持源图比例,不随容器uv拉伸)
          // 1) 按“目标/源”宽高比做 uv 轴向校正，使单瓦片单元为源图比例
          float aspectFix = rDst / max(rSrc, 1e-6);
          vec2 uvTile = (uv0 - 0.5) * vec2(aspectFix, 1.0) + 0.5;

          // 2) 可选：应用仅含旋转/平移的 _ImageTransform(若包含非等比缩放会再次引入拉伸)
          // uvTile = applyTransform(_ImageTransform, uvTile);

          // 3) 重复密度（正值放大重复次数，支持负值时可用 sign 控制翻转）
          float s = max(abs(_ImageScalingFactor), 1e-6);
          uv = fract(uvTile * s);
        }

        vec4 img = texture2D(_ImageTex, uv);

        // 对于 FIT/CROP 模式，区域外设为透明
        if(maskOutside) {
            if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                img.a = 0.0;
            }
        }

        img.a *= _ImageOpacity;
        finalColor = img;
    }

    finalColor.rgb *= finalColor.a;
    gl_FragColor = finalColor;
}
`;

  get shape () {
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

    const gradientStrokeFill: SolidPaint = {
      type: FillType.Solid,
      color: new Color(1, 1, 1, 1),
    };

    this.strokes.push(gradientStrokeFill);

    const gradientLayerFill: SolidPaint = {
      type: FillType.Solid,
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
    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i];

      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), material, i);
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
        const lineStyle = this.strokeAttributes;

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

    this.updatePaintMaterial(this.material, this.fills[0]);
    this.updatePaintMaterial(this.materials[1], this.strokes[0]);
  }

  private updatePaintMaterial (material: Material, paint: Paint) {
    material.setFloat('_FillType', paint.type);

    if (paint.type === FillType.Solid) {
      material.color = paint.color;
    } else if (paint.type === FillType.GradientLinear || paint.type === FillType.GradientAngular || paint.type === FillType.GradientRadial) {
      this.updateGradientMaterial(material, paint.gradientStops, paint.startPoint, paint.endPoint);
    } else if (paint.type === FillType.Texture) {
      material.setInt('_ImageScaleMode', paint.scaleMode);
      material.setVector2('_ImageSize', new Vector2(paint.texture.getWidth(), paint.texture.getHeight()));

      const boundingBox = this.getBoundingBox();
      const topRight = boundingBox.area[0].p1;
      const bottomLeft = boundingBox.area[1].p2;

      material.setVector2('_DestSize', new Vector2(topRight.x - bottomLeft.x, topRight.y - bottomLeft.y));
      material.setFloat('_ImageOpacity', paint.opacity);
      material.setFloat('_ImageScalingFactor', paint.scalingFactor);
      material.setTexture('_ImageTex', paint.texture);
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

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.shapeDirty = true;

    if (data.mask) {
      this.maskManager.setMaskOptions(data.mask);
    }

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

    const strokeAttributes = data.stroke;

    if (strokeAttributes) {
      this.strokeAttributes = {
        width: strokeAttributes.width,
        alignment: 0.5,
        cap: strokeAttributes.cap,
        join: strokeAttributes.join,
        miterLimit: 10,
      };
    }

    //@ts-expect-error
    for (const stroke of data.strokes) {
      const strokeParam = stroke as PaintData;

      if (strokeParam) {
        this.hasStroke = true;
        this.strokes[0] = this.createPaint(strokeParam);
      }
    }

    //@ts-expect-error
    for (const fill of data.fills) {
      const fillParam = fill as PaintData;

      if (fillParam) {
        this.hasFill = true;
        this.fills[0] = this.createPaint(fillParam);
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
  }

  private createPaint (paintData: PaintData): Paint {
    let paint: Paint;

    switch (paintData.type) {
      case FillType.Solid: {
        paint = {
          type:paintData.type,
          color:new Color().copyFrom(paintData.color),
        };

        break;
      }
      case FillType.GradientLinear:
      case FillType.GradientAngular:
      case FillType.GradientRadial: {
        paint = {
          type:paintData.type,
          gradientStops:createValueGetter(paintData.gradientStops) as GradientValue,
          startPoint:new Vector2().copyFrom(paintData.startPoint),
          endPoint: new Vector2().copyFrom(paintData.endPoint),
        };

        break;
      }
      case FillType.Texture:{
        paint = {
          type:paintData.type,
          texture: this.engine.findObject<Texture>(paintData.texture),
          scaleMode: paintData.scaleMode,
          scalingFactor: paintData.scalingFactor ?? 1,
          opacity: paintData.opacity ?? 1,
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

export type PaintData =
  | SolidPaintData
  | GradientPaintData
  | TexturePaintData;

export interface SolidPaintData {
  type: FillType.Solid,
  /**
   * 填充颜色
   */
  color: spec.ColorData,
}

export interface GradientPaintData {
  type: FillType.GradientLinear | FillType.GradientAngular | FillType.GradientRadial,
  /**
   * 渐变颜色
   */
  gradientStops: spec.GradientColor,
  /**
   * 渐变起点
   */
  startPoint: spec.Vector2Data,
  /**
   * 渐变终点
   */
  endPoint: spec.Vector2Data,
}

export interface TexturePaintData {
  type: FillType.Texture,
  texture: spec.DataPath,
  scaleMode: TexturePaintScaleMode,
  scalingFactor?: number,
  opacity?: number,
}