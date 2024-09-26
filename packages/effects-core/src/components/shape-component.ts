import { Color } from '@galacean/effects-math/es/core/color';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import type { ShapePath } from '../plugins/shape/shape-path';
import { triangulate } from '../plugins/shape/triangulate';
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
  path = new GraphicsPath();

  private curveValues: CurveData[] = [];
  private geometry: Geometry;
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
      this.path.clear();
      this.path.moveTo(this.curveValues[this.curveValues.length - 1].point.x, this.curveValues[this.curveValues.length - 1].point.y);

      for (const curveValue of this.curveValues) {
        const point = curveValue.point;
        const control1 = curveValue.controlPoint1;
        const control2 = curveValue.controlPoint2;

        this.path.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, point.x, point.y, 1);
      }

      this.buildGeometryFromPath(this.path.shapePath);
      this.dirty = false;
    }
  }

  override render (renderer: Renderer): void {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    renderer.drawGeometry(this.geometry, this.material);
  }

  buildGeometryFromPath (shapePath: ShapePath) {
    const shapePrimitives = shapePath.shapePrimitives;
    const vertices: number[] = [];

    // triangulate shapePrimitive
    for (const shapePrimitive of shapePrimitives) {
      const shape = shapePrimitive.shape;

      vertices.push(...triangulate([shape.points]));
    }

    // build vertices and uvs
    const vertexCount = vertices.length / 2;

    let positionArray = this.geometry.getAttributeData('aPos');
    let uvArray = this.geometry.getAttributeData('aUV');

    if (!positionArray || positionArray.length < vertexCount * 3) {
      positionArray = new Float32Array(vertexCount * 3);
    }
    if (!uvArray || uvArray.length < vertexCount * 2) {
      uvArray = new Float32Array(vertexCount * 2);
    }

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

    this.geometry.setAttributeData('aPos', positionArray);
    this.geometry.setAttributeData('aUV', uvArray);
    this.geometry.setDrawCount(vertexCount);
  }

  override fromData (data: ShapeCustomComponent): void {
    super.fromData(data);

    const points = data.param.points;
    const easingIns = data.param.easingIn;
    const easingOuts = data.param.easingOut;

    for (const shape of data.param.shapes) {
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
