import { Color } from '@galacean/effects-math/es/core/color';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import type { ShapePath } from '../plugins/shape/shape-path';
import type { Renderer } from '../render';
import { Geometry, GLSLVersion } from '../render';
import { RendererComponent } from './renderer-component';

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
export class ShapeComponent extends RendererComponent {

  private path = new GraphicsPath();
  private curveValues: CurveData[] = [];
  private geometry: Geometry;
  private data: ShapeComponentData;
  private dirty = false;

  private vert = `
precision highp float;

attribute vec3 aPos;//x y

varying vec4 vColor;

uniform vec4 _Color;
uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;

void main() {
  vColor = _Color;
  vec4 pos = vec4(aPos.xyz, 1.0);
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
}
`;

  private frag = `
precision highp float;

varying vec4 vColor;

void main() {
  vec4 color = vec4(1.0,1.0,1.0,1.0);
  gl_FragColor = color;
}
`;

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
          aUV:{
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
      this.material.depthMask = true;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override onUpdate (dt: number): void {
    if (this.dirty) {
      this.buildPath(this.data);
      this.buildGeometryFromPath(this.path.shapePath);
      // this.dirty = false;
    }
  }

  override render (renderer: Renderer): void {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    renderer.drawGeometry(this.geometry, this.material);
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
    switch (data.type) {
      case ComponentShapeType.CUSTOM : {
        const customData = data as ShapeCustomComponent;
        const points = customData.param.points;
        const easingIns = customData.param.easingIn;
        const easingOuts = customData.param.easingOut;

        this.curveValues = [];

        for (const shape of customData.param.shapes) {
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
      case ComponentShapeType.ELLIPSE:{
        const ellipseData = data as ShapeEllipseComponent;
        const ellipseParam = ellipseData.param;

        this.path.ellipse(0, 0, ellipseParam.xRadius, ellipseParam.yRadius);

        break;
      }
    }
  }

  override fromData (data: ShapeComponentData): void {
    super.fromData(data);
    this.data = data;

    this.dirty = true;
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
  type: ComponentShapeType,
}

/**
 * 矢量图形类型
 */
export enum ComponentShapeType {
  /**
   * 自定义图形
   */
  CUSTOM,
  /**
   * 矩形
   */
  RECTANGLE,
  /**
   * 椭圆
   */
  ELLIPSE,
  /**
   * 多边形
   */
  POLYGON,
  /**
   * 星形
   */
  STAR,
}

/**
 * 自定义图形组件
 */
export interface ShapeCustomComponent extends ShapeComponentData {
  /**
   * 矢量类型 - 形状
   */
  type: ComponentShapeType.CUSTOM,
  /**
   * 矢量参数 - 形状
   */
  param: ShapeCustomParam,
}

/**
 * 矢量路径参数
 */
export interface ShapeCustomParam {
  /**
   * 路径点
   */
  points: spec.Vector3Data[],
  /**
   * 入射控制点
   */
  easingIn: spec.Vector3Data[],
  /**
   * 入射控制点
   */
  easingOut: spec.Vector3Data[],
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
  color: spec.ColorExpression,
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
  color: spec.ColorExpression,
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
 * @description 椭圆组件参数
 */
export interface ShapeEllipseComponent extends ShapeComponentData {
  type: ComponentShapeType.ELLIPSE,
  param: ShapeEllipseParam,
}

/**
 * @description 椭圆参数
 */
export interface ShapeEllipseParam {
  /**
   * @description x轴半径
   * -- TODO 后续完善类型
   * -- TODO 可以看一下用xRadius/yRadius 还是 width/height
   */
  xRadius: number,
  /**
   * @description y轴半径
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