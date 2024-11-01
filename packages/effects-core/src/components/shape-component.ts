import { Color } from '@galacean/effects-math/es/core/color';
import type * as spec from '@galacean/effects-specification';
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

interface CurveData {
  point: spec.Vector3Data,
  controlPoint1: spec.Vector3Data,
  controlPoint2: spec.Vector3Data,
}

/**
 * 图形组件
 * @since 2.1.0
 */
@effectsClass('ShapeComponent')
export class ShapeComponent extends MeshComponent {

  private path = new GraphicsPath();
  private curveValues: CurveData[] = [];
  private data: ShapeComponentData;
  private animated = true;

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
  gl_FragColor = color;
}
`;

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
    }

    if (!this.material) {
      const materialProps: MaterialProps = {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
          glslVersion: GLSLVersion.GLSL1,
        },
      };

      this.material = Material.create(engine, materialProps);
      this.material.setColor('_Color', new Color(1, 1, 1, 1));
      this.material.depthMask = false;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.buildPath(this.data);
      this.buildGeometryFromPath(this.path.shapePath);
    }
  }

  private buildGeometryFromPath (shapePath: ShapePath) {
    const shapePrimitives = shapePath.shapePrimitives;
    const vertices: number[] = [];
    const indices: number[] = [];

    // triangulate shapePrimitive
    for (const shapePrimitive of shapePrimitives) {
      const shape = shapePrimitive.shape;
      const points: number[] = [];
      const indexOffset = indices.length;
      const vertOffset = vertices.length / 2;

      shape.build(points);

      shape.triangulate(points, vertices, vertOffset, indices, indexOffset);
    }

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
    if (!indexArray) {
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
  }

  private buildPath (data: ShapeComponentData) {
    this.path.clear();

    const shapeData = data;

    switch (shapeData.type) {
      case ShapePrimitiveType.Custom: {
        const customData = shapeData as CustomShapeData;
        const points = customData.points;
        const easingIns = customData.easingIns;
        const easingOuts = customData.easingOuts;

        this.curveValues = [];

        for (const shape of customData.shapes) {
          this.setFillColor(shape.fill);

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
        }

        this.path.moveTo(this.curveValues[this.curveValues.length - 1].point.x, this.curveValues[this.curveValues.length - 1].point.y);

        for (const curveValue of this.curveValues) {
          const point = curveValue.point;
          const control1 = curveValue.controlPoint1;
          const control2 = curveValue.controlPoint2;

          this.path.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, point.x, point.y, 1);
        }

        break;
      }
      case ShapePrimitiveType.Ellipse: {
        const ellipseData = shapeData as EllipseData;

        this.path.ellipse(0, 0, ellipseData.xRadius, ellipseData.yRadius);

        this.setFillColor(ellipseData.fill);

        break;
      }
      case ShapePrimitiveType.Rectangle: {
        const rectangleData = shapeData as RectangleData;

        this.path.rect(-rectangleData.width / 2, rectangleData.height / 2, rectangleData.width, rectangleData.height);

        this.setFillColor(rectangleData.fill);

        break;
      }
      case ShapePrimitiveType.Star: {
        const starData = shapeData as StarData;

        this.path.polyStar(starData.pointCount, starData.outerRadius, starData.innerRadius, starData.outerRoundness, starData.innerRoundness, StarType.Star);

        this.setFillColor(starData.fill);

        break;
      }
      case ShapePrimitiveType.Polygon: {
        const polygonData = shapeData as PolygonData;

        this.path.polyStar(polygonData.pointCount, polygonData.radius, polygonData.radius, polygonData.roundness, polygonData.roundness, StarType.Polygon);

        this.setFillColor(polygonData.fill);

        break;
      }
    }
  }

  private setFillColor (fill?: ShapeFillParam) {
    if (fill) {
      const color = fill.color;

      this.material.setColor('_Color', new Color(color.r, color.g, color.b, color.a));
    }
  }

  override fromData (data: ShapeComponentData): void {
    super.fromData(data);
    this.data = data;

    const material = this.material;

    //@ts-expect-error // TODO 新版蒙版上线后重构
    material.stencilRef = data.renderer.mask !== undefined ? [data.renderer.mask, data.renderer.mask] : undefined;
    //@ts-expect-error // TODO 新版蒙版上线后重构
    setMaskMode(material, data.renderer.maskMode);
  }
}

/************************** Test Interface **********************************/

/**
 * 矢量图形组件
 */
export interface ShapeComponentData extends spec.ComponentData {
  /**
   * 矢量类型
   */
  type: ShapePrimitiveType,
}

/**
 * 矢量图形类型
 */
export enum ShapePrimitiveType {
  /**
   * 自定义图形
   */
  Custom,
  /**
   * 矩形
   */
  Rectangle,
  /**
   * 椭圆
   */
  Ellipse,
  /**
   * 多边形
   */
  Polygon,
  /**
   * 星形
   */
  Star,
}

/**
 * 自定义图形组件
 */
export interface CustomShapeData extends ShapeComponentData {
  /**
   * 矢量类型 - 形状
   */
  type: ShapePrimitiveType.Custom,
  /**
   * 路径点
   */
  points: spec.Vector3Data[],
  /**
   * 入射控制点
   */
  easingIns: spec.Vector3Data[],
  /**
   * 入射控制点
   */
  easingOuts: spec.Vector3Data[],
  /**
   * 自定义形状
   */
  shapes: CustomShape[],
}

/**
 * 自定义形状参数
 */
export interface CustomShape {
  /**
   * 是否垂直与平面 - 用于减少实时运算
   */
  verticalToPlane: 'x' | 'y' | 'z' | 'none',
  /**
   * 点索引 - 用于构成闭合图形
   */
  indexes: CustomShapePoint[],
  /**
   * 是否为闭合图形 - 用于Stroke
   */
  close: boolean,
  /**
   * 填充属性
   */
  fill?: ShapeFillParam,
  /**
   * 描边属性
   */
  stroke?: ShapeStrokeParam,
  /**
   * 空间变换
   */
  transform?: spec.TransformData,
}

/**
 * 自定义形状点
 */
export interface CustomShapePoint {
  /**
   * 顶点索引
   */
  point: number,
  /**
   * 入射点索引
   */
  easingIn: number,
  /**
   * 出射点索引
   */
  easingOut: number,
}

/**
 * 矢量填充参数
 */
export interface ShapeFillParam {
  /**
   * 填充颜色
   */
  color: spec.ColorData,
}

/**
 * 矢量描边参数
 */
export interface ShapeStrokeParam {
  /**
   * 线宽
   */
  width: number,
  /**
   * 线颜色
   */
  color: spec.ColorData,
  /**
   * 连接类型
   */
  connectType: ShapeConnectType,
  /**
   * 点类型
   */
  pointType: ShapePointType,
}

// 本期无该功能 待补充
export enum ShapeConnectType {

}

// @待补充
export enum ShapePointType {
}

/**
 * 椭圆组件参数
 */
export interface EllipseData extends ShapeComponentData {
  type: ShapePrimitiveType.Ellipse,
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
  /**
   * 填充属性
   */
  fill?: ShapeFillParam,
  /**
   * 描边属性
   */
  stroke?: ShapeStrokeParam,
  /**
   * 空间变换
   */
  transform?: spec.TransformData,
}

/**
 * 星形参数
 */
export interface StarData extends ShapeComponentData {
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
  /**
   * 填充属性
   */
  fill?: ShapeFillParam,
  /**
   * 描边属性
   */
  stroke?: ShapeStrokeParam,
  /**
   * 空间变换
   */
  transform?: spec.TransformData,
}

/**
 * 多边形参数
 */
export interface PolygonData extends ShapeComponentData {
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
  /**
   * 填充属性
   */
  fill?: ShapeFillParam,
  /**
   * 描边属性
   */
  stroke?: ShapeStrokeParam,
  /**
   * 空间变换
   */
  transform?: spec.TransformData,
}

/**
 * 矩形参数
 */
export interface RectangleData extends ShapeComponentData {
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
  /**
   * 填充属性
   */
  fill?: ShapeFillParam,
  /**
   * 描边属性
   */
  stroke?: ShapeStrokeParam,
  /**
   * 空间变换
   */
  transform?: spec.TransformData,
}
