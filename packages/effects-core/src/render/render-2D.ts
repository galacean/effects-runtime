import * as spec from '@galacean/effects-specification';
import { Color } from '@galacean/effects-math/es/core/color';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Geometry } from './geometry';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Material } from '../material';
import { GraphicsPath } from '../math/shape/graphics-path';
import type { StrokeAttributes } from '../math/shape/build-line';
import { buildLine } from '../math/shape/build-line';
import type { ShapePath } from '../math/shape/shape-path';

export class Render2D {
  private geometry: Geometry;
  private material: Material;
  private graphicsPath = new GraphicsPath();

  private vertices: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  private lineStyle: StrokeAttributes = {
    width: 1,
    alignment: 0.5,
    cap: spec.LineCap.Butt,
    join: spec.LineJoin.Miter,
    miterLimit: 10,
  };

  // 变换栈和缓存（使用 Matrix3 进行 2D 变换）
  private transformStack: Matrix3[] = [];
  private currentTransform: Matrix3 = Matrix3.fromIdentity();

  private get currentVertexCount () {
    return this.vertices.length / 2;
  }

  private get currentIndexCount () {
    return this.indices.length;
  }

  constructor (private engine: Engine) {
    this.geometry = Geometry.create(this.engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([
            -0.5, 0.5,  //左上
            -0.5, -0.5, //左下
            0.5, 0.5, //右上
            0.5, -0.5, //右下
          ]),
        },
        aColor: {
          type: glContext.FLOAT,
          size: 4,
          data: new Float32Array([
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
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

    this.material = Material.create(this.engine, {
      shader: {
        vertex: `attribute vec2 aPos;
        attribute vec4 aColor;
        varying vec4 vColor;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision mediump float;
        varying vec4 vColor;
        void main() { 
          gl_FragColor = vColor;
        }`,
      },
    });

    this.material.depthTest = false;
    this.material.depthMask = false;
  }

  /**
   * 清空缓冲区，准备新的绘制批次
   */
  begin (): void {
    this.indices.length = 0;
    this.vertices.length = 0;
    this.colors.length = 0;

    this.transformStack = [];
    this.currentTransform = Matrix3.fromIdentity();

    // 创建从屏幕坐标到 NDC 的投影矩阵，屏幕坐标: (0, 0) 在左下角, (width, height) 在右上角
    const width = this.engine.renderer.getWidth();
    const height = this.engine.renderer.getHeight();

    // 正交投影矩阵：将屏幕坐标 [0, width] x [0, height] 映射到 NDC [-1, 1] x [-1, 1]
    const projectionMatrix = new Matrix4(
      2 / width, 0, 0, 0,  // 第一列
      0, 2 / height, 0, 0,  // 第二列
      0, 0, -1, 0,  // 第三列
      -1, -1, 0, 1   // 第四列
    );

    this.material.setMatrix('effects_MatrixVP', projectionMatrix);
  }

  /**
   * 将当前变换压入栈，并设置新的变换
   * @param transform - 新的变换矩阵（会与当前变换相乘）
   */
  pushTransform (transform: Matrix3): void {
    this.transformStack.push(this.currentTransform.clone());
    this.currentTransform = this.currentTransform.premultiply(transform);
  }

  /**
   * 恢复上一个变换
   */
  popTransform (): void {
    const transform = this.transformStack.pop();

    if (!transform) {
      console.warn('Render2D: 变换栈为空，无法弹出');

      return;
    }

    this.currentTransform = transform;
  }

  /**
   * 刷新并渲染所有累积的绘制命令
   */
  end (): void {
    if (this.currentVertexCount === 0 || this.currentIndexCount === 0) {
      return;
    }

    const verticesArray = new Float32Array(this.vertices);
    const colorsArray = new Float32Array(this.colors);
    const indicesArray = new Uint16Array(this.indices);

    this.geometry.setAttributeData('aPos', verticesArray);
    this.geometry.setAttributeData('aColor', colorsArray);
    this.geometry.setIndexData(indicesArray);
    this.geometry.setDrawCount(this.currentIndexCount);

    this.engine.renderer.drawGeometry(this.geometry, Matrix4.IDENTITY, this.material);
  }

  /**
   * 线段顶点按顺序连接 (p0-p1, p1-p2, p2-p3, ...)
   * @param points - 点数组，格式 [x1,y1,x2,y2,...]，至少需要2个点（4个数值）
   * @param color - 线条颜色，范围 0-1
   * @param thickness - 线宽（像素）
   */
  drawLines (points: number[], color: Color = Color.WHITE, thickness: number = 1.0): void {
    if (!points || points.length < 4 || points.length % 2 !== 0) {
      console.warn('drawLines: 至少需要2个点(4个数值), 且数组长度必须为偶数');

      return;
    }

    const numPoints = points.length / 2;
    const closed = points[0] === points[points.length - 2] && points[1] === points[points.length - 1];
    const actualPoints = closed ? numPoints - 1 : numPoints;

    this.graphicsPath.clear();
    this.graphicsPath.moveTo(points[0], points[1]);

    for (let i = 1; i < actualPoints; i++) {
      this.graphicsPath.lineTo(points[i * 2], points[i * 2 + 1]);
    }

    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, closed);
  }

  /**
   * 绘制单条线段
   * @param x1 - 起点x
   * @param y1 - 起点y
   * @param x2 - 终点x
   * @param y2 - 终点y
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawLine (x1: number, y1: number, x2: number, y2: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.graphicsPath.clear();
    this.graphicsPath.moveTo(x1, y1);
    this.graphicsPath.lineTo(x2, y2);

    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, closed);
  }

  /**
   * 绘制贝塞尔曲线
   * @param x1 - 起点x
   * @param y1 - 起点y
   * @param x2 - 控制点1x
   * @param y2 - 控制点1y
   * @param x3 - 控制点2x
   * @param y3 - 控制点2y
   * @param x4 - 终点x
   * @param y4 - 终点y
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawBezier (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.graphicsPath.clear();
    this.graphicsPath.moveTo(x1, y1);
    this.graphicsPath.bezierCurveTo(x2, y2, x3, y3, x4, y4);

    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, false);
  }

  /**
   * 绘制三角形边框
   * @param x1 - 顶点1x
   * @param y1 - 顶点1y
   * @param x2 - 顶点2x
   * @param y2 - 顶点2y
   * @param x3 - 顶点3x
   * @param y3 - 顶点3y
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.graphicsPath.clear();
    this.graphicsPath.triangle(x1, y1, x2, y2, x3, y3);

    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, true);
  }

  /**
   * 绘制矩形边框
   * @param x - 矩形左下角 X 坐标
   * @param y - 矩形左下角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 矩形颜色
   */
  drawRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.graphicsPath.clear();
    this.graphicsPath.rect(x, y, width, height, 0);

    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, true);
  }

  /**
   * 绘制圆形边框
   * @param cx - 圆心x
   * @param cy - 圆心y
   * @param radius - 半径
   * @param color - 线条颜色
   * @param thickness - 线宽
   */
  drawCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.graphicsPath.clear();
    this.graphicsPath.circle(cx, cy, radius);
    this.buildShapeLine(this.graphicsPath.shapePath, color, thickness, true);
  }

  /**
   * 绘制填充三角形
   * @param x1 - 顶点1x
   * @param y1 - 顶点1y
   * @param x2 - 顶点2x
   * @param y2 - 顶点2y
   * @param x3 - 顶点3x
   * @param y3 - 顶点3y
   * @param color - 填充颜色
   */
  fillTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE): void {
    this.graphicsPath.clear();
    this.graphicsPath.triangle(x1, y1, x2, y2, x3, y3);

    this.buildShape(this.graphicsPath.shapePath, color);
  }

  /**
   * 绘制填充矩形
   * @param x - 矩形左下角 X 坐标
   * @param y - 矩形左下角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 矩形颜色
   */
  fillRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE): void {
    this.graphicsPath.clear();
    this.graphicsPath.rect(x, y, width, height, 0);

    this.buildShape(this.graphicsPath.shapePath, color);
  }

  /**
   * 绘制填充圆形
   * @param cx - 圆心x
   * @param cy - 圆心y
   * @param radius - 半径
   * @param color - 填充颜色
   */
  fillCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE): void {
    this.graphicsPath.clear();
    this.graphicsPath.circle(cx, cy, radius);
    this.buildShape(this.graphicsPath.shapePath, color);
  }

  dispose (): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private buildShape (shape: ShapePath, color: Color) {
    for (const shapePrimitive of shape.shapePrimitives) {
      const shape = shapePrimitive.shape;
      const buildPoints: number[] = [];
      const indexOffset = this.indices.length;
      const vertexOffset = this.vertices.length / 2;

      shape.build(buildPoints);
      shape.triangulate(buildPoints, this.vertices, vertexOffset, this.indices, indexOffset);

      this.applyTransformAndColor(vertexOffset, this.vertices.length / 2 - vertexOffset, color);
    }
  }

  private buildShapeLine (shape: ShapePath, color: Color, thickness: number, closed = false): void {
    for (const shapePrimitive of shape.shapePrimitives) {
      const shape = shapePrimitive.shape;
      const buildPoints: number[] = [];
      const indexOffset = this.indices.length;
      const vertexOffset = this.vertices.length / 2;

      shape.build(buildPoints);
      this.lineStyle.width = thickness;
      buildLine(buildPoints, this.lineStyle, false, closed, this.vertices, 2, vertexOffset, this.indices, indexOffset);

      this.applyTransformAndColor(vertexOffset, this.vertices.length / 2 - vertexOffset, color);
    }
  }

  private applyTransformAndColor (vertexOffset: number, count: number, color: Color): void {
    for (let i = 0; i < count; i++) {
      const vertexStart = (vertexOffset + i) * 2;
      const colorStart = (vertexOffset + i) * 4;

      this.applyTransform(this.vertices[vertexStart], this.vertices[vertexStart + 1], this.vertices, vertexStart);

      this.colors[colorStart] = color.r;
      this.colors[colorStart + 1] = color.g;
      this.colors[colorStart + 2] = color.b;
      this.colors[colorStart + 3] = color.a;
    }
  }

  /**
   * 应用自定义变换到点
   * @param x - 点的 x 坐标
   * @param y - 点的 y 坐标
   * @param result - 变换结果存储数组
   * @param offset - 存储数组的偏移位置
   */
  private applyTransform (x: number, y: number, result: number[], offset = 0): void {
    const m = this.currentTransform.elements;

    result[offset] = m[0] * x + m[3] * y + m[6];
    result[offset + 1] = m[1] * x + m[4] * y + m[7];
  }
}