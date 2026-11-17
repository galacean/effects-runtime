import * as spec from '@galacean/effects-specification';
import { RendererComponent } from './renderer-component';
import type { VFXItem } from '../vfx-item';
import { Material, type Maskable } from '../material';
import type { Renderer } from '../render';
import { BufferUsage, Geometry, VertexElementType } from '../render';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Color } from '@galacean/effects-math/es/core/color';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import { effectsClass } from '../decorators';
import { HitTestType, type HitTestTriangleParams } from '../plugins';
import { addItem } from '../utils';
import { FrameTitle, type FrameTitleStyleData } from './frame-title';
import type { Paint } from '../plugins/shape/paint';
import { createPaint, createPaintMaterial, updatePaintMaterial } from '../plugins/shape/paint';
import type { StrokeAttributes } from '../math/shape/stroke-attributes';
import { expandStrokePath, flattenStrokePath } from '../math/shape/stroke-expansion';
import { triangulate } from '../math/shape/triangulate';
import { GraphicsPath } from '../plugins/shape/graphics-path';
import { makeStrokeContourPath } from '../plugins/shape/contour-path';
import type { Texture } from '../texture';

export interface FrameComponentData extends spec.ComponentData {
  fills?: spec.PaintData[],
  strokes?: spec.PaintData[],
  strokeWidth?: number,
  strokeAlignment?: number,
  strokeCap?: spec.LineCap,
  strokeJoin?: spec.LineJoin,
  strokeMiterLimit?: number,
  titleStyle?: FrameTitleStyleData,
}

@effectsClass('FrameComponent')
export class FrameComponent extends RendererComponent implements Maskable {
  fills: Paint[] = [{ type: spec.FillType.Solid, color: new Color(1, 1, 1, 1) }];
  strokes: Paint[] = [];
  readonly titleRenderer = new FrameTitle(this.engine);

  private readonly strokeAttributes: Omit<StrokeAttributes, 'variableWidthPoints'> = {
    width: 1,
    alignment: 0.5,
    cap: spec.LineCap.Butt,
    join: spec.LineJoin.Miter,
    miterLimit: 10,
  };
  private clipGeometry: Geometry;
  private strokeGeometry?: Geometry;
  private strokePositions = new Float32Array(0);
  private strokeGeometryDirty = true;
  private strokeGeometryWidth = 0;
  private strokeGeometryHeight = 0;
  private clipMaterial: Material;
  private readonly fillMaterials: Material[] = [];
  private readonly strokeMaterials: Material[] = [];
  private readonly paintSize = new Vector2();
  private worldMatrix = new Matrix4();

  /** 描边宽度，使用屏幕逻辑像素。 */
  get strokeWidth (): number {
    return this.strokeAttributes.width;
  }

  set strokeWidth (value: number) {
    if (this.strokeAttributes.width !== value) {
      this.strokeAttributes.width = value;
      this.strokeGeometryDirty = true;
    }
  }

  get strokeAlignment (): number {
    return this.strokeAttributes.alignment;
  }

  set strokeAlignment (value: number) {
    if (this.strokeAttributes.alignment !== value) {
      this.strokeAttributes.alignment = value;
      this.strokeGeometryDirty = true;
    }
  }

  get strokeCap (): spec.LineCap {
    return this.strokeAttributes.cap;
  }

  set strokeCap (value: spec.LineCap) {
    if (this.strokeAttributes.cap !== value) {
      this.strokeAttributes.cap = value;
      this.strokeGeometryDirty = true;
    }
  }

  get strokeJoin (): spec.LineJoin {
    return this.strokeAttributes.join;
  }

  set strokeJoin (value: spec.LineJoin) {
    if (this.strokeAttributes.join !== value) {
      this.strokeAttributes.join = value;
      this.strokeGeometryDirty = true;
    }
  }

  get strokeMiterLimit (): number {
    return this.strokeAttributes.miterLimit;
  }

  set strokeMiterLimit (value: number) {
    if (this.strokeAttributes.miterLimit !== value) {
      this.strokeAttributes.miterLimit = value;
      this.strokeGeometryDirty = true;
    }
  }

  override onAwake (): void {
    this.clipGeometry = Geometry.create(this.engine, {
      attributes: {
        [VertexElementType.Position]: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array([
            -0.5, 0.5, 0, //左上
            -0.5, -0.5, 0, //左下
            0.5, 0.5, 0, //右上
            0.5, -0.5, 0, //右下
          ]),
        },
        [VertexElementType.TexCoord0]: {
          size: 2,
          offset: 0,
          type: glContext.FLOAT,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });

    const material = Material.create(this.engine, {
      shader: {
        fragment: `
          precision mediump float;

          uniform vec4 _Color;

          void main() {
            gl_FragColor = vec4(_Color.rgb * _Color.a, _Color.a);
          }
        `,
        vertex: `
          precision highp float;
          attribute vec3 aPos;
          uniform mat4 effects_ObjectToWorld;
          uniform mat4 effects_MatrixVP;
          void main() {
            gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
          }
        `,
        shared: true,
      },
    });

    material.depthTest = true;
    material.depthMask = false;
    material.blending = true;
    material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
    material.setColor('_Color', Color.WHITE);

    this.clipMaterial = material;
    this.material = material;
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onPreRender (): void {
    this.setClipRectangle();

    const size = this.updateDecorationGeometry();

    this.paintSize.set(size?.width ?? Math.abs(this.transform.size.x), size?.height ?? Math.abs(this.transform.size.y));

    this.updatePaints(this.fills, this.fillMaterials);
    this.updatePaints(this.strokes, this.strokeMaterials);
    this.materials = [this.clipMaterial, ...this.fillMaterials, ...this.strokeMaterials, ...this.titleRenderer.materials];
  }

  override render (renderer: Renderer): void {
    this.maskManager.drawStencilMask(renderer, this);

    // 直接按列缩放矩阵元素以实现右乘 size 矩阵（column-major）
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());

    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);

    for (const material of this.fillMaterials) {
      renderer.drawGeometry(this.clipGeometry, this.worldMatrix, material);
    }
    if (this.strokeGeometry && this.strokeAttributes.width > 0) {
      for (const material of this.strokeMaterials) {
        renderer.drawGeometry(this.strokeGeometry, this.worldMatrix, material);
      }
    }
    this.titleRenderer.render(renderer);
  }

  override onDestroy (): void {
    this.clipGeometry.dispose();
    this.strokeGeometry?.dispose();
    this.titleRenderer.dispose();
    this.fillMaterials.forEach(material => material.dispose());
    this.strokeMaterials.forEach(material => material.dispose());
    this.clipMaterial.dispose();
  }

  drawStencilMask (maskRef: number): void {
    if (!this.isActiveAndEnabled) {
      return;
    }

    // 直接按列缩放矩阵元素以实现右乘 size 矩阵（column-major）
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());

    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);

    this.maskManager.drawGeometryMask(this.engine.renderer, this.clipGeometry, this.worldMatrix, this.clipMaterial, maskRef);
  }

  override fromData (data: FrameComponentData): void {
    super.fromData(data);

    if (data.fills !== undefined) {
      this.fills = data.fills.map(paint => createPaint(paint, path => this.findObject<Texture>(path)));
    }
    if (data.strokes !== undefined) {
      this.strokes = data.strokes.map(paint => createPaint(paint, path => this.findObject<Texture>(path)));
    }
    this.strokeWidth = data.strokeWidth ?? 1;
    this.strokeAlignment = data.strokeAlignment ?? 0.5;
    this.strokeCap = data.strokeCap ?? spec.LineCap.Butt;
    this.strokeJoin = data.strokeJoin ?? spec.LineJoin.Miter;
    this.strokeMiterLimit = data.strokeMiterLimit ?? 10;

    if (data.titleStyle !== undefined) {
      this.titleRenderer.fromData(data.titleStyle);
    }
  }

  private getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
    this.updateDecorationGeometry();
    if (!force && !this.titleRenderer.visible) {
      return;
    }

    // frame 边的四角（局部 [-0.5, 0.5] 经 size 与世界变换）
    const sizeMatrix = Matrix4.fromScale(this.transform.size.x, this.transform.size.y, 1);
    const worldMatrix = sizeMatrix.premultiply(this.transform.getWorldMatrix());
    const toWorld = (x: number, y: number) => worldMatrix.transformPoint(new Vector3(x, y, 0), new Vector3());
    const TL = toWorld(-0.5, 0.5);
    const TR = toWorld(0.5, 0.5);
    const BR = toWorld(0.5, -0.5);
    const BL = toWorld(-0.5, -0.5);

    // 命中带为屏幕像素恒定的环带，中心落在 frame 边上，仅边缘可命中（内部镂空）
    const thickness = this.getBorderWorldThickness(TL, TR);
    const triangles = force ? [...this.getBorderTriangles(TL, TR, BR, BL, thickness), ...this.getStrokeTriangles(worldMatrix)] : [];

    triangles.push(...this.titleRenderer.getHitTestTriangles());

    return {
      type: HitTestType.triangle,
      triangles,
      backfaceCulling: false,
      clipMasks: this.frameClipMasks,
    };
  };

  private updatePaints (paints: Paint[], materials: Material[]): void {
    while (materials.length > paints.length) {
      materials.pop()?.dispose();
    }
    for (let i = 0; i < paints.length; i++) {
      materials[i] ??= createPaintMaterial(this.engine);
      updatePaintMaterial(materials[i], paints[i], this.paintSize);
    }
  }

  /**
   * 由相机把命中带的屏幕像素厚度换算成世界厚度。对齐 Excalidraw frame 命中阈值：
   * 描边两侧各 0.85 × DEFAULT_COLLISION_THRESHOLD（≈8px），整条带 ≈13.6px，不受 size/scale/zoom 影响。
   */
  private getBorderWorldThickness (topLeft: Vector3, topRight: Vector3): number {
    const fallbackThickness = 0.05; // 相机不可用时的兜底世界厚度
    const camera = this.item.composition?.camera;

    if (!camera) {
      return fallbackThickness;
    }

    const screenLeft = camera.worldToScreenPoint(topLeft);
    const screenRight = camera.worldToScreenPoint(topRight);
    const pixelDist = Math.hypot(screenRight.x - screenLeft.x, screenRight.y - screenLeft.y);
    const worldDist = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y) || 1;
    const pixelPerWorldUnit = pixelDist / worldDist;

    // 命中带整条宽度（像素）：2 × 0.85 × DEFAULT_COLLISION_THRESHOLD，其中 DEFAULT_COLLISION_THRESHOLD ≈ 8
    const borderPixels = Math.max(2 * 0.85 * 8, this.strokeAttributes.width);

    return pixelPerWorldUnit > 0 ? borderPixels / pixelPerWorldUnit : fallbackThickness;
  }

  /** 根据当前相机投影更新自身描边和标题，绘制与命中共用同一份顶点。 */
  private updateDecorationGeometry (): { width: number, height: number } | undefined {
    this.titleRenderer.hide();
    const camera = this.item.composition?.camera;

    if (!camera) {
      return;
    }
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());
    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);
    const project = (x: number, y: number) => camera.worldToScreenPoint(this.worldMatrix.transformPoint(new Vector3(x, y, 0)));
    const topLeft = project(-0.5, 0.5);
    const topRight = project(0.5, 0.5);
    const bottomLeft = project(-0.5, -0.5);
    const width = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
    const height = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);

    if (width <= 0 || height <= 0) {
      return;
    }
    if (this.strokeAttributes.width > 0 && this.strokes.length > 0) {
      this.updateStrokeGeometry(width, height);
    }
    this.titleRenderer.update(this, [topLeft, topRight, project(0.5, -0.5), bottomLeft]);

    return { width, height };
  }

  /** Expand the border independently of the rectangular clip applied to children. */
  private updateStrokeGeometry (width: number, height: number): void {
    // 描边保持屏幕逻辑像素宽度，投影尺寸变化时也需要重建。
    if (!this.strokeGeometryDirty && width === this.strokeGeometryWidth && height === this.strokeGeometryHeight) {
      return;
    }
    const style = this.strokeAttributes;
    const indices: number[] = [];
    const path = new GraphicsPath().rect(-width / 2, -height / 2, width, height, 0);
    const expanded = expandStrokePath(makeStrokeContourPath(path), style, 1);
    const contours = flattenStrokePath(expanded, 1);
    const vertices = triangulate(contours.map(contour => contour.points), 'nonzero');

    for (let i = 0; i < vertices.length / 2; i++) {
      indices.push(i);
    }

    const count = vertices.length / 2;
    const positions = this.strokePositions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const x = vertices[i * 2] / width;
      const y = vertices[i * 2 + 1] / height;

      positions.set([x, y, 0], i * 3);
      uvs.set([x + 0.5, y + 0.5], i * 2);
    }
    if (!this.strokeGeometry) {
      this.strokeGeometry = Geometry.create(this.engine, {
        bufferUsage: BufferUsage.Dynamic,
        attributes: {
          [VertexElementType.Position]: { type: glContext.FLOAT, size: 3, data: positions },
          [VertexElementType.TexCoord0]: { type: glContext.FLOAT, size: 2, data: uvs },
        },
        indices: { data: new Uint16Array(indices) },
        mode: glContext.TRIANGLES,
        drawCount: indices.length,
      });
    } else {
      this.updateStrokeAttribute(VertexElementType.Position, positions, 3);
      this.updateStrokeAttribute(VertexElementType.TexCoord0, uvs, 2);
      this.strokeGeometry.setIndexData(new Uint16Array(indices));
      this.strokeGeometry.setDrawCount(indices.length);
    }
    this.strokeGeometryWidth = width;
    this.strokeGeometryHeight = height;
    this.strokeGeometryDirty = false;
  }

  private updateStrokeAttribute (name: string, data: Float32Array, size: number): void {
    const geometry = this.strokeGeometry!;
    const buffer = geometry.getVertexBuffer(name)?.buffer;

    if (!buffer || data.byteLength > buffer.capacity) {
      geometry.setVerticesData(name, data, { size }, BufferUsage.Dynamic);
    } else {
      geometry.setAttributeData(name, data);
    }
  }

  /** 非居中描边及连接处也使用实际渲染顶点参与命中。 */
  private getStrokeTriangles (worldMatrix: Matrix4): TriangleLike[] {
    if (!this.strokeGeometry || this.strokes.length === 0 || this.strokeAttributes.width <= 0) {
      return [];
    }
    const indices = this.strokeGeometry.getIndexData();
    const positions = this.strokePositions;
    const toWorld = (index: number) => worldMatrix.transformPoint(new Vector3(
      positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2],
    ));
    const triangles: TriangleLike[] = [];

    for (let i = 0; i < indices.length; i += 3) {
      triangles.push({ p0: toWorld(indices[i]), p1: toWorld(indices[i + 1]), p2: toWorld(indices[i + 2]) });
    }

    return triangles;
  }

  /**
   * 构造以 frame 边为中心、给定世界厚度的边框环带三角形（内部镂空）。
   * 带中心落在 frame 边上：half 向外、half 向内；沿 frame 局部坐标轴偏移以兼容旋转。
   */
  private getBorderTriangles (
    TL: Vector3, TR: Vector3, BR: Vector3, BL: Vector3,
    thickness: number,
  ): TriangleLike[] {
    // frame 局部坐标轴在世界空间的方向
    const axisX = TR.clone().subtract(TL).normalize();
    const axisY = TL.clone().subtract(BL).normalize();
    const offset = (corner: Vector3, dx: number, dy: number) =>
      corner.clone().addScaledVector(axisX, dx).addScaledVector(axisY, dy);

    // 外圈向外扩 half、内圈向内收 half，使带中心落在 frame 边上
    const half = thickness / 2;
    const outerTL = offset(TL, -half, half);
    const outerTR = offset(TR, half, half);
    const outerBR = offset(BR, half, -half);
    const outerBL = offset(BL, -half, -half);
    const innerTL = offset(TL, half, -half);
    const innerTR = offset(TR, -half, -half);
    const innerBR = offset(BR, -half, half);
    const innerBL = offset(BL, half, half);

    // 每条带是一个四边形，拆成 2 个三角形
    const quad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3): TriangleLike[] => [
      { p0: a, p1: b, p2: c }, { p0: a, p1: c, p2: d },
    ];

    return [
      ...quad(outerTL, outerTR, innerTR, innerTL), // 上
      ...quad(outerTR, outerBR, innerBR, innerTR), // 右
      ...quad(outerBR, outerBL, innerBL, innerBR), // 下
      ...quad(outerBL, outerTL, innerTL, innerBL), // 左
    ];
  }

  private setClipRectangle (): void {
    this.setClipRectangleRecursive(this.item);
  }

  private setClipRectangleRecursive (item: VFXItem): void {
    for (const child of item.children) {
      const childFrameComponent = child.getComponent(RendererComponent);

      if (childFrameComponent) {
        addItem(childFrameComponent.frameClipMasks, this);
      }

      this.setClipRectangleRecursive(child);
    }
  }
}

/**
 * 矩阵右乘 diag(sx, sy, 1, 1) 等价于按列分别乘以 sx, sy, 1, 1
 */
function multiplyMatrixByScale (matrix: Matrix4, sx: number, sy: number): void {
  const e = matrix.elements;

  // 列优先存储：elements 0-3 第一列，4-7 第二列，8-11 第三列，12-15 第四列
  // 右乘 diag(sx, sy, 1, 1) 等价于按列分别乘以 sx, sy, 1, 1
  e[0] *= sx; e[1] *= sx; e[2] *= sx; e[3] *= sx; // 第一列 * sx
  e[4] *= sy; e[5] *= sy; e[6] *= sy; e[7] *= sy; // 第二列 * sy
  // 第三列 (z) 乘 1，无需修改
  // 第四列 (位移) 乘 1，无需修改
}
