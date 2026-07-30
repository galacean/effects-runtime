import type * as spec from '@galacean/effects-specification';
import { RendererComponent } from './renderer-component';
import type { VFXItem } from '../vfx-item';
import { Material, type Maskable } from '../material';
import type { Renderer } from '../render';
import { Geometry } from '../render';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Color } from '@galacean/effects-math/es/core/color';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import { effectsClass } from '../decorators';
import { HitTestType, type HitTestTriangleParams } from '../plugins';
import { addItem } from '../utils';

interface FrameComponentData extends spec.ComponentData {
  color?: spec.ColorData,
}

@effectsClass('FrameComponent')
export class FrameComponent extends RendererComponent implements Maskable {
  color = new Color(1, 1, 1, 1);

  private clipGeometry: Geometry;
  private worldMatrix = new Matrix4();

  override onAwake (): void {
    this.clipGeometry = Geometry.create(this.engine, {
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

    const material = Material.create(this.engine, {
      shader: {
        fragment: `
          precision mediump float;

          uniform vec4 _Color;

          void main() {
            gl_FragColor = _Color;
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
    material.setColor('_Color', this.color);

    this.material = material;
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;
  }

  override onPreRender (): void {
    this.setClipRectangle();

    this.material.setColor('_Color', this.color);
  }

  override render (renderer: Renderer): void {
    this.maskManager.drawStencilMask(renderer, this);

    // 直接按列缩放矩阵元素以实现右乘 size 矩阵（column-major）
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());

    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);

    renderer.drawGeometry(this.clipGeometry, this.worldMatrix, this.material);
  }

  override onDestroy (): void {
    this.clipGeometry.dispose();
    this.material.dispose();
  }

  drawStencilMask (maskRef: number): void {
    if (!this.isActiveAndEnabled) {
      return;
    }

    // 直接按列缩放矩阵元素以实现右乘 size 矩阵（column-major）
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());

    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);

    this.maskManager.drawGeometryMask(this.engine.renderer, this.clipGeometry, this.worldMatrix, this.material, maskRef);
  }

  override fromData (data: FrameComponentData): void {
    super.fromData(data);

    if (data.color) {
      this.color.copyFrom(data.color);
    }
  }

  private getHitTestParams = (force?: boolean): HitTestTriangleParams | undefined => {
    if (!force) {
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
    const triangles = this.getBorderTriangles(TL, TR, BR, BL, thickness);

    return {
      type: HitTestType.triangle,
      triangles,
      clipMasks: this.frameClipMasks,
    };
  };

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
    const borderPixels = 2 * 0.85 * 8;

    return pixelPerWorldUnit > 0 ? borderPixels / pixelPerWorldUnit : fallbackThickness;
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