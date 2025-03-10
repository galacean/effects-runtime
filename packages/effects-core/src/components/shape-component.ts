import { Color } from '@galacean/effects-math/es/core/color';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material, setMaskMode } from '../material';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import type { ShapePath } from '../plugins/shape/shape-path';
import { Geometry, GLSLVersion } from '../render';
import { MeshComponent } from './mesh-component';
import { StarType } from '../plugins/shape/poly-star';
import type { StrokeAttributes } from '../plugins/shape/build-line';
import { buildLine } from '../plugins/shape/build-line';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Polygon } from '../plugins/shape/polygon';

interface CurveData {
  point: spec.Vector2Data,
  controlPoint1: spec.Vector2Data,
  controlPoint2: spec.Vector2Data,
}

interface FillAttribute {
  color: Color,
}

interface ShapeAttribute {
  /**
   * 矢量图形类型
   */
  type: spec.ShapePrimitiveType,
  /**
   * 填充属性
   */
  fill?: spec.ShapeFillParam,
}

/**
 * 自定义图形参数
 */
interface CustomShapeAttribute extends ShapeAttribute {
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
export interface EllipseAttribute extends ShapeAttribute {
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
export interface RectangleAttribute extends ShapeAttribute {
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
export interface StarAttribute extends ShapeAttribute {
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
export interface PolygonAttribute extends ShapeAttribute {
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
export class ShapeComponent extends MeshComponent {
  private hasStroke = false;
  private hasFill = false;
  private shapeDirty = true;

  private graphicsPath = new GraphicsPath();
  private curveValues: CurveData[] = [];
  private fillAttribute: FillAttribute;
  private strokeAttributes: StrokeAttributes;
  private shapeAttribute: ShapeAttribute;

  private vert = `
precision highp float;

attribute vec3 aPos;//x y

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;

void main() {
  vec4 pos = vec4(aPos.xyz, 1.0);
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
}
`;

  private frag = `
precision highp float;

uniform vec4 _Color;

void main() {
  vec4 color = _Color;
  color.rgb *= color.a;
  gl_FragColor = color;
}
`;

  get shape () {
    this.shapeDirty = true;

    return this.shapeAttribute;
  }

  /**
   *
   * @param engine
   */
  constructor (engine: Engine) {
    super(engine);

    if (!this.geometry) {
      this.geometry = Geometry.create(engine, {
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
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array(),
          },
        },
        mode: glContext.TRIANGLES,
        drawCount: 4,
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

    if (!this.material) {
      const materialProps: MaterialProps = {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
          glslVersion: GLSLVersion.GLSL1,
        },
      };

      const fillMaterial = Material.create(engine, materialProps);

      fillMaterial.setColor('_Color', new Color(1, 1, 1, 1));
      fillMaterial.depthMask = false;
      fillMaterial.depthTest = true;
      fillMaterial.blending = true;
      this.material = fillMaterial;

      const strokeMaterial = Material.create(engine, materialProps);

      strokeMaterial.setColor('_Color', new Color(0.25, 0.25, 0.25, 1));
      strokeMaterial.depthMask = false;
      strokeMaterial.depthTest = true;
      strokeMaterial.blending = true;
      this.materials[1] = strokeMaterial;
    }

    this.strokeAttributes = {
      width: 1,
      alignment: 0.5,
      cap: spec.LineCap.Butt,
      join: spec.LineJoin.Miter,
      miterLimit: 10,
      color: new Color(1, 1, 1, 1),
    };

    this.fillAttribute = {
      color: new Color(1, 1, 1, 1),
    };

    this.shapeAttribute = {
      type: spec.ShapePrimitiveType.Custom,
      points: [],
      easingIns: [],
      easingOuts: [],
      shapes: [],
    } as CustomShapeAttribute;
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    this.material.color = this.fillAttribute.color;
    this.materials[1].color = this.strokeAttributes.color;
    if (this.shapeDirty) {
      this.buildPath(this.shapeAttribute);
      this.buildGeometryFromPath(this.graphicsPath.shapePath);
      this.shapeDirty = false;
    }
  }

  private buildGeometryFromPath (shapePath: ShapePath) {
    const shapePrimitives = shapePath.shapePrimitives;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Triangulate shapePrimitive
    //---------------------------------------------------

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

        let close = false;

        if (this.shapeAttribute.type === spec.ShapePrimitiveType.Custom) {
          close = (shape as Polygon).closePath;
        }

        shape.build(points);
        buildLine(points, lineStyle, false, close, vertices, 2, vertOffset, indices, indexOffset);
      }
    }
    const strokeIndexCount = indices.length - fillIndexCount;
    const vertexCount = vertices.length / 2;

    // get the current attribute and index arrays from the geometry, avoiding re-creation
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

    // set position and uv attribute array
    for (let i = 0; i < vertexCount; i++) {
      const pointsOffset = i * 3;
      const positionArrayOffset = i * 2;
      const uvOffset = i * 2;

      positionArray[pointsOffset] = vertices[positionArrayOffset];
      positionArray[pointsOffset + 1] = vertices[positionArrayOffset + 1];
      positionArray[pointsOffset + 2] = 0;

      uvArray[uvOffset] = positionArray[pointsOffset];
      uvArray[uvOffset + 1] = positionArray[pointsOffset + 1];
    }

    // set index array
    indexArray.set(indices);

    // rewrite to geometry
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

  private buildPath (shapeAttribute: ShapeAttribute) {
    this.graphicsPath.clear();

    switch (shapeAttribute.type) {
      case spec.ShapePrimitiveType.Custom: {
        const customShapeAtribute = this.shapeAttribute as CustomShapeAttribute;
        const points = customShapeAtribute.points;
        const easingIns = customShapeAtribute.easingIns;
        const easingOuts = customShapeAtribute.easingOuts;

        for (const shape of customShapeAtribute.shapes) {
          this.curveValues = [];

          const indices = shape.indexes;

          for (let i = 1; i < indices.length; i++) {
            const pointIndex = indices[i];
            const lastPointIndex = indices[i - 1];

            this.curveValues.push({
              point: points[pointIndex.point],
              controlPoint1: easingOuts[lastPointIndex.easingOut],
              controlPoint2: easingIns[pointIndex.easingIn],
            });
          }

          // Push the last curve
          this.curveValues.push({
            point: points[indices[0].point],
            controlPoint1: easingOuts[indices[indices.length - 1].easingOut],
            controlPoint2: easingIns[indices[0].easingIn],
          });

          this.graphicsPath.moveTo(this.curveValues[this.curveValues.length - 1].point.x, this.curveValues[this.curveValues.length - 1].point.y);

          for (const curveValue of this.curveValues) {
            const point = curveValue.point;
            const control1 = curveValue.controlPoint1;
            const control2 = curveValue.controlPoint2;

            this.graphicsPath.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, point.x, point.y, 1);
          }

          if (shape.close) {
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

  override fromData (data: spec.ShapeComponentData): void {
    super.fromData(data);
    this.shapeDirty = true;

    const strokeParam = data.stroke;

    if (strokeParam) {
      this.hasStroke = true;
      this.strokeAttributes.width = strokeParam.width;
      this.strokeAttributes.color.copyFrom(strokeParam.color);
      this.strokeAttributes.cap = strokeParam.cap;
      this.strokeAttributes.join = strokeParam.join;
    }

    const fillParam = data.fill;

    if (fillParam) {
      this.hasFill = true;
      this.fillAttribute.color.copyFrom(fillParam.color);
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
          fill: customShapeData.fill,
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

        this.shapeAttribute = customShapeAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Ellipse: {
        const ellipseData = data as spec.EllipseData;
        const ellipseAttribute: EllipseAttribute = {
          type: spec.ShapePrimitiveType.Ellipse,
          xRadius: ellipseData.xRadius,
          yRadius: ellipseData.yRadius,
          fill: ellipseData.fill,
        };

        this.shapeAttribute = ellipseAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Rectangle: {
        const rectangleData = data as spec.RectangleData;
        const rectangleAttribute: RectangleAttribute = {
          type: spec.ShapePrimitiveType.Rectangle,
          width: rectangleData.width,
          height: rectangleData.height,
          roundness: rectangleData.roundness,
          fill: rectangleData.fill,
        };

        this.shapeAttribute = rectangleAttribute;

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
          fill: starData.fill,
        };

        this.shapeAttribute = starAttribute;

        break;
      }
      case spec.ShapePrimitiveType.Polygon: {
        const polygonData = data as spec.PolygonData;
        const polygonAttribute: PolygonAttribute = {
          type: spec.ShapePrimitiveType.Polygon,
          pointCount: polygonData.pointCount,
          radius: polygonData.radius,
          roundness: polygonData.roundness,
          fill: polygonData.fill,
        };

        this.shapeAttribute = polygonAttribute;

        break;
      }
    }

    const material = this.material;

    //@ts-expect-error // TODO 新版蒙版上线后重构
    material.stencilRef = data.renderer.mask !== undefined ? [data.renderer.mask, data.renderer.mask] : undefined;
    //@ts-expect-error // TODO 新版蒙版上线后重构
    setMaskMode(material, data.renderer.maskMode);
  }
}
