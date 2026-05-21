import * as spec from '@galacean/effects-specification';
import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Geometry } from './geometry';
import { Material } from '../material';
import { buildLine } from '../math';
import type { StrokeAttributes } from '../math';
import { buildAdaptiveBezier } from '../math/shape/build-adaptive-bezier';
import { Circle } from '../math/shape/circle';
import { Polygon } from '../math/shape/polygon';
import { Rectangle } from '../math/shape/rectangle';
import type { ShapePrimitive } from '../math/shape/shape-primitive';
import { Triangle } from '../math/shape/triangle';
import type { Texture } from '../texture';
import type { FontStyle, FontWeight } from './text-cache';
import { ATLAS_SIZE, TextCache } from './text-cache';

/**
 * 纹理 UV 子矩形(Y 向上,Y=0 在底部)。 全图为 `{u0:0, v0:0, u1:1, v1:1}`
 */
export type TextureRegion = { u0: number, v0: number, u1: number, v1: number };

const FULL_REGION: TextureRegion = { u0: 0, v0: 0, u1: 1, v1: 1 };

type BatchType = 'colored' | 'textured';

export class Graphics {
  private geometry: Geometry;
  private coloredMaterial: Material;
  private texturedMaterial: Material;

  private readonly lineShape = new Polygon();
  private readonly bezierShape = new Polygon();
  private readonly triangleShape = new Triangle();
  private readonly rectangleShape = new Rectangle();
  private readonly circleShape = new Circle();
  private readonly buildPoints: number[] = [];

  private vertices: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  private lineStyle: StrokeAttributes = {
    width: 1,
    alignment: 0.5,
    cap: spec.LineCap.Butt,
    join: spec.LineJoin.Miter,
    miterLimit: 10,
  };

  // 当前批次状态:批次切换时(类型变化或纹理变化)需要 flush
  private currentBatchType: BatchType = 'colored';
  private currentBatchTexture: Texture | null = null;

  /** 文本纹理 LRU 缓存,drawText 用 */
  private textCache: TextCache;

  // 变换栈和缓存(使用 Matrix3 进行 2D 变换)
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

    this.coloredMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        varying vec4 vColor;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        void main() {
          vec4 color = vColor;
          color.rgb *= color.a;
          gl_FragColor = color;
        }`,
      },
    });
    this.coloredMaterial.depthTest = false;
    this.coloredMaterial.depthMask = false;
    this.coloredMaterial.blending = true;

    this.texturedMaterial = Material.create(this.engine, {
      shader: {
        vertex: `precision highp float;
        attribute vec2 aPos;
        attribute vec4 aColor;
        attribute vec2 aUV;
        varying vec4 vColor;
        varying vec2 vUV;

        uniform mat4 effects_MatrixVP;
        void main() {
          vColor = aColor;
          vUV = aUV;
          gl_Position = effects_MatrixVP * vec4(aPos, 0.0, 1.0);
        }`,
        fragment: `precision highp float;
        varying vec4 vColor;
        varying vec2 vUV;
        uniform sampler2D uMainTexture;
        void main() {
          vec4 color = texture2D(uMainTexture, vUV) * vColor;
          color.rgb *= color.a;
          gl_FragColor = color;
        }`,
      },
    });
    this.texturedMaterial.depthTest = false;
    this.texturedMaterial.depthMask = false;
    this.texturedMaterial.blending = true;

    this.textCache = new TextCache(engine);
  }

  /**
   * 清空缓冲区,准备新的绘制批次
   */
  begin (): void {
    this.indices.length = 0;
    this.vertices.length = 0;
    this.colors.length = 0;
    this.uvs.length = 0;

    this.transformStack = [];
    this.currentTransform = Matrix3.fromIdentity();

    this.currentBatchType = 'colored';
    this.currentBatchTexture = null;

    // 创建从屏幕坐标到 NDC 的投影矩阵,屏幕坐标: (0, 0) 在左下角, (width, height) 在右上角
    const { width, height } = this.engine.canvas.getBoundingClientRect();

    // 正交投影矩阵:将屏幕坐标 [0, width] x [0, height] 映射到 NDC [-1, 1] x [-1, 1]
    const projectionMatrix = new Matrix4(
      2 / width, 0, 0, 0,  // 第一列
      0, 2 / height, 0, 0,  // 第二列
      0, 0, -1, 0,  // 第三列
      -1, -1, 0, 1   // 第四列
    );

    this.coloredMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
    this.texturedMaterial.setMatrix('effects_MatrixVP', projectionMatrix);
  }

  /**
   * 将当前变换压入栈,并设置新的变换
   * @param transform - 新的变换矩阵(会与当前变换相乘)
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
      console.warn('Render2D: 变换栈为空,无法弹出');

      return;
    }

    this.currentTransform = transform;
  }

  /**
   * 刷新并渲染所有累积的绘制命令
   */
  end (): void {
    this.flushBatch();
  }

  /**
   * 切换到指定批次类型/纹理。若与当前批次不一致,先 flush 已累积顶点
   */
  private ensureBatch (type: BatchType, texture: Texture | null = null): void {
    const sameBatch = this.currentBatchType === type
      && (type !== 'textured' || this.currentBatchTexture === texture);

    if (!sameBatch && this.currentVertexCount > 0) {
      this.flushBatch();
    }

    this.currentBatchType = type;
    this.currentBatchTexture = texture;
  }

  /**
   * 提交当前累积的顶点到 renderer,清空缓冲(批次内部 flush 不重置 batchType)
   */
  private flushBatch (): void {
    if (this.currentVertexCount === 0 || this.currentIndexCount === 0) {
      return;
    }

    // 把所有 dirty 的字符 atlas 内容上传到 GPU,确保即将采样的 textured 批次拿到最新像素;
    // 一帧多次 drawText 共写同一 atlas 只在 flush 边界 upload 一次,避免每次 drawText 都重传整张 canvas
    this.textCache.uploadDirty();

    const verticesArray = new Float32Array(this.vertices);
    const colorsArray = new Float32Array(this.colors);
    const uvsArray = new Float32Array(this.uvs);
    const indicesArray = new Uint16Array(this.indices);

    this.geometry.setAttributeData('aPos', verticesArray);
    this.geometry.setAttributeData('aColor', colorsArray);
    this.geometry.setAttributeData('aUV', uvsArray);
    this.geometry.setIndexData(indicesArray);
    this.geometry.setDrawCount(this.currentIndexCount);

    let material: Material;

    if (this.currentBatchType === 'textured') {
      material = this.texturedMaterial;
      const tex = this.currentBatchTexture ?? this.engine.whiteTexture;

      material.setTexture('uMainTexture', tex);
    } else {
      material = this.coloredMaterial;
    }

    this.engine.renderer.drawGeometry(this.geometry, Matrix4.IDENTITY, material);

    this.indices.length = 0;
    this.vertices.length = 0;
    this.colors.length = 0;
    this.uvs.length = 0;
  }

  /**
   * 线段顶点按顺序连接 (p0-p1, p1-p2, p2-p3, ...)
   * @param points - 点数组,格式 [x1,y1,x2,y2,...],至少需要2个点(4个数值)
   * @param color - 线条颜色,范围 0-1
   * @param thickness - 线宽(像素)
   */
  drawLines (points: number[], color: Color = Color.WHITE, thickness: number = 1.0): void {
    if (!points || points.length < 4 || points.length % 2 !== 0) {
      console.warn('drawLines: 至少需要2个点(4个数值), 且数组长度必须为偶数');

      return;
    }

    const numPoints = points.length / 2;
    const closed = points[0] === points[points.length - 2] && points[1] === points[points.length - 1];
    const actualPoints = closed ? numPoints - 1 : numPoints;

    const linePoints = this.lineShape.points;

    linePoints.length = 0;
    for (let i = 0; i < actualPoints; i++) {
      linePoints.push(points[i * 2], points[i * 2 + 1]);
    }

    this.ensureBatch('colored');
    this.buildShapeLine(this.lineShape, color, thickness, closed);
  }

  /**
   * 绘制单条线段
   * @param x1 - 起点 X 坐标
   * @param y1 - 起点 Y 坐标
   * @param x2 - 终点 X 坐标
   * @param y2 - 终点 Y 坐标
   * @param color - 线条颜色,默认白色,范围 0-1
   * @param thickness - 线宽(像素),默认 1
   */
  drawLine (x1: number, y1: number, x2: number, y2: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    const linePoints = this.lineShape.points;

    linePoints.length = 0;
    linePoints.push(x1, y1, x2, y2);

    this.ensureBatch('colored');
    this.buildShapeLine(this.lineShape, color, thickness, false);
  }

  /**
   * 绘制三阶贝塞尔曲线(P0 起点,P1/P2 控制点,P3 终点)
   * @param x1 - P0 起点 X 坐标
   * @param y1 - P0 起点 Y 坐标
   * @param x2 - P1 第一控制点 X 坐标
   * @param y2 - P1 第一控制点 Y 坐标
   * @param x3 - P2 第二控制点 X 坐标
   * @param y3 - P2 第二控制点 Y 坐标
   * @param x4 - P3 终点 X 坐标
   * @param y4 - P3 终点 Y 坐标
   * @param color - 曲线颜色,默认白色,范围 0-1
   * @param thickness - 线宽(像素),默认 1
   */
  drawBezier (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    const bezierPoints = this.bezierShape.points;

    bezierPoints.length = 0;
    bezierPoints.push(x1, y1);
    buildAdaptiveBezier(bezierPoints, x1, y1, x2, y2, x3, y3, x4, y4);

    this.ensureBatch('colored');
    this.buildShapeLine(this.bezierShape, color, thickness, false);
  }

  /**
   * 绘制三角形边框(闭合连接 3 个顶点)
   * @param x1 - 顶点 1 X 坐标
   * @param y1 - 顶点 1 Y 坐标
   * @param x2 - 顶点 2 X 坐标
   * @param y2 - 顶点 2 Y 坐标
   * @param x3 - 顶点 3 X 坐标
   * @param y3 - 顶点 3 Y 坐标
   * @param color - 边框颜色,默认白色,范围 0-1
   * @param thickness - 线宽(像素),默认 1
   */
  drawTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.setTriangleShape(x1, y1, x2, y2, x3, y3);
    this.ensureBatch('colored');
    this.buildShapeLine(this.triangleShape, color, thickness, true);
  }

  /**
   * 绘制矩形边框
   * @param x - 矩形左下角 X 坐标
   * @param y - 矩形左下角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 边框颜色,默认白色,范围 0-1
   * @param thickness - 线宽(像素),默认 1
   */
  drawRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.setRectangleShape(x, y, width, height, 0);
    this.ensureBatch('colored');
    this.buildShapeLine(this.rectangleShape, color, thickness, true);
  }

  /**
   * 绘制圆形边框
   * @param cx - 圆心 X 坐标
   * @param cy - 圆心 Y 坐标
   * @param radius - 半径(像素)
   * @param color - 边框颜色,默认白色,范围 0-1
   * @param thickness - 线宽(像素),默认 1
   */
  drawCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE, thickness: number = 1.0): void {
    this.setCircleShape(cx, cy, radius);
    this.ensureBatch('colored');
    this.buildShapeLine(this.circleShape, color, thickness, true);
  }

  /**
   * 绘制填充三角形(实心)
   * @param x1 - 顶点 1 X 坐标
   * @param y1 - 顶点 1 Y 坐标
   * @param x2 - 顶点 2 X 坐标
   * @param y2 - 顶点 2 Y 坐标
   * @param x3 - 顶点 3 X 坐标
   * @param y3 - 顶点 3 Y 坐标
   * @param color - 填充颜色,默认白色,范围 0-1
   */
  fillTriangle (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: Color = Color.WHITE): void {
    this.setTriangleShape(x1, y1, x2, y2, x3, y3);
    this.ensureBatch('colored');
    this.buildShape(this.triangleShape, color);
  }

  /**
   * 绘制填充矩形
   * @param x - 矩形左下角 X 坐标
   * @param y - 矩形左下角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param color - 填充颜色,默认白色,范围 0-1
   *
   * 直接用 pushQuad(2 三角形分割)而不是 setRectangleShape + buildShape,
   * 后者走 Rectangle.triangulate 的中心 fan,中心顶点连到 4 角的 4 条对角内边
   * 在 MSAA / 亚像素精度下会暴露 1-2 像素缝隙,叠层时底层颜色透出形成可见对角痕迹
   */
  fillRectangle (x: number, y: number, width: number, height: number, color: Color = Color.WHITE): void {
    this.ensureBatch('colored');
    this.pushQuad(x, y, width, height, color);
  }

  /**
   * 绘制填充圆形(实心)
   * @param cx - 圆心 X 坐标
   * @param cy - 圆心 Y 坐标
   * @param radius - 半径(像素)
   * @param color - 填充颜色,默认白色,范围 0-1
   */
  fillCircle (cx: number, cy: number, radius: number, color: Color = Color.WHITE): void {
    this.setCircleShape(cx, cy, radius);
    this.ensureBatch('colored');
    this.buildShape(this.circleShape, color);
  }

  /**
   * 绘制纹理矩形(本地坐标,Y 向上,(x, y) 为左下角)
   * @param x - 矩形左下角 X 坐标
   * @param y - 矩形左下角 Y 坐标
   * @param width - 矩形宽度
   * @param height - 矩形高度
   * @param texture - 要采样的纹理。同纹理连续绘制会合批,纹理切换会自动 flush 当前批次
   * @param region - 纹理 UV 子矩形,默认全图。Y 向上,(u0,v0) 为左下角 UV
   * @param color - 乘色,默认白色
   */
  drawTexture (
    x: number, y: number, width: number, height: number,
    texture: Texture,
    region: TextureRegion = FULL_REGION,
    color: Color = Color.WHITE,
  ): void {
    this.ensureBatch('textured', texture);
    this.pushQuad(x, y, width, height, color, region);
  }

  /**
   * 绘制文本(本地坐标,Y 向上,(x, y) 为文本左下角)。
   *
   * 文本走字符级 bitmap atlas(同一字体下每个字只渲染一次,任意文本组合复用 atlas);
   * `color` 作为乘色与白色字形 alpha 相乘,任意颜色都不会污染 atlas。
   *
   * 字体参数全部展开,避免调用方每帧创建临时 style 对象触发 GC
   * @param x - 文本左下角 X 坐标
   * @param y - 文本左下角 Y 坐标(对齐 baseline 上方 ascent 处)
   * @param text - 要绘制的文本内容,空串直接 return
   * @param fontSize - 字号(逻辑像素)
   * @param color - 乘色,默认白色,范围 0-1
   * @param fontFamily - 字体族,默认 `sans-serif`
   * @param fontWeight - 字重,默认 `normal`,支持 `'bold'` 或数字
   * @param fontStyle - 字形,默认 `normal`,支持 `'italic'`
   */
  drawText (
    x: number, y: number,
    text: string,
    fontSize: number,
    color: Color = Color.WHITE,
    fontFamily: string = 'sans-serif',
    fontWeight: FontWeight = 'normal',
    fontStyle: FontStyle = 'normal',
  ): void {
    if (!text) {
      return;
    }
    const atlas = this.textCache.getAtlas(fontSize, fontFamily, fontWeight, fontStyle);

    this.ensureBatch('textured', atlas.texture);

    const lineHeight = atlas.lineHeight;
    let cursorX = x;

    // ensureChar 可能往 atlas canvas 写新字并打 dirty 标;实际 upload 推迟到
    // flushBatch 统一处理,这样一帧多次 drawText 共写同一 atlas 只 upload 一次
    for (let i = 0; i < text.length; i++) {
      const info = atlas.ensureChar(text[i]);

      if (!info) {
        continue;
      }
      // atlas 像素坐标 → UV(纹理 flipY 后,canvas 顶 → v=1,canvas 底 → v=0)
      const u0 = info.px / ATLAS_SIZE;
      const u1 = (info.px + info.pw) / ATLAS_SIZE;
      const v0 = 1 - (info.py + info.ph) / ATLAS_SIZE;
      const v1 = 1 - info.py / ATLAS_SIZE;

      this.pushQuad(cursorX, y, info.width, lineHeight, color, { u0, v0, u1, v1 });
      cursorX += info.width;
    }
  }

  dispose (): void {
    this.geometry.dispose();
    this.coloredMaterial.dispose();
    this.texturedMaterial.dispose();
    this.textCache.dispose();
  }

  private buildShape (shape: ShapePrimitive, color: Color): void {
    const buildPoints = this.buildPoints;
    const indexOffset = this.indices.length;
    const vertexOffset = this.vertices.length / 2;

    buildPoints.length = 0;
    shape.build(buildPoints);
    shape.triangulate(buildPoints, this.vertices, vertexOffset, this.indices, indexOffset);

    this.applyTransformAndColor(vertexOffset, this.vertices.length / 2 - vertexOffset, color);
  }

  private buildShapeLine (shape: ShapePrimitive, color: Color, thickness: number, closed = false): void {
    const buildPoints = this.buildPoints;
    const indexOffset = this.indices.length;
    const vertexOffset = this.vertices.length / 2;

    buildPoints.length = 0;
    shape.build(buildPoints);
    this.lineStyle.width = thickness;
    buildLine(buildPoints, this.lineStyle, false, closed, this.vertices, 2, vertexOffset, this.indices, indexOffset);

    this.applyTransformAndColor(vertexOffset, this.vertices.length / 2 - vertexOffset, color);
  }

  private setTriangleShape (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.triangleShape.x = x1;
    this.triangleShape.y = y1;
    this.triangleShape.x2 = x2;
    this.triangleShape.y2 = y2;
    this.triangleShape.x3 = x3;
    this.triangleShape.y3 = y3;
  }

  private setRectangleShape (x: number, y: number, width: number, height: number, roundness: number): void {
    this.rectangleShape.x = x;
    this.rectangleShape.y = y;
    this.rectangleShape.width = width;
    this.rectangleShape.height = height;
    this.rectangleShape.roundness = roundness;
  }

  private setCircleShape (x: number, y: number, radius: number): void {
    this.circleShape.x = x;
    this.circleShape.y = y;
    this.circleShape.radius = radius;
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

      // colored 批次的 UV 不会被读取,但仍写入 0 以保持 vertices/uvs 数组等长
      this.uvs[vertexStart] = 0;
      this.uvs[vertexStart + 1] = 0;
    }
  }

  /**
   * 推一个 quad(4 顶点 + 6 索引,2 个三角形)。
   *
   * - colored 批次:`region` 省略 → UV 写 0(shader 不读)
   * - textured 批次:传 `region` → UV 按 region 写
   *
   * 之所以用 2 三角形而不是中心 fan(像 Rectangle.triangulate),是因为 fan 的中心顶点连到 4 角的对角内边
   * 在像素级亚像素精度下会暴露 1-2 像素缝隙,叠层时底层颜色透出形成可见的对角痕迹
   */
  private pushQuad (
    x: number, y: number, width: number, height: number,
    color: Color,
    region?: TextureRegion,
  ): void {
    const vertexOffset = this.vertices.length / 2;

    // 4 顶点(本地坐标,左下/右下/左上/右上),应用当前变换写入 vertices
    const corners: [number, number][] = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ];
    const u0 = region ? region.u0 : 0;
    const v0 = region ? region.v0 : 0;
    const u1 = region ? region.u1 : 0;
    const v1 = region ? region.v1 : 0;
    const cornerUVs: [number, number][] = [
      [u0, v0],
      [u1, v0],
      [u0, v1],
      [u1, v1],
    ];

    for (let i = 0; i < 4; i++) {
      const vIndex = (vertexOffset + i) * 2;
      const cIndex = (vertexOffset + i) * 4;

      this.applyTransform(corners[i][0], corners[i][1], this.vertices, vIndex);

      this.colors[cIndex] = color.r;
      this.colors[cIndex + 1] = color.g;
      this.colors[cIndex + 2] = color.b;
      this.colors[cIndex + 3] = color.a;

      this.uvs[vIndex] = cornerUVs[i][0];
      this.uvs[vIndex + 1] = cornerUVs[i][1];
    }

    this.indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset + 2, vertexOffset + 1, vertexOffset + 3,
    );
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
