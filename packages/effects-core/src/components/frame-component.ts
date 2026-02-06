import { RendererComponent } from './renderer-component';
import type { VFXItem } from '../vfx-item';
import { Material, type Maskable } from '../material';
import type { Renderer } from '../render';
import { Geometry } from '../render';
import { glContext } from '../gl';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Color } from '@galacean/effects-math/es/core/color';
import { effectsClass } from '../decorators';

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

  override onUpdate (dt: number): void {
    this.setClipRectangle();

    this.material.setColor('_Color', this.color);
  }

  private setClipRectangle (): void {
    this.setClipRectangleRecursive(this.item);
  }

  private setClipRectangleRecursive (item: VFXItem): void {
    for (const child of item.children) {
      const childFrameComponent = child.getComponent(RendererComponent);

      if (childFrameComponent) {
        childFrameComponent.frameClipMask = this;
      }

      if (!(childFrameComponent instanceof FrameComponent)) {
        this.setClipRectangleRecursive(child);
      }
    }
  }

  override render (renderer: Renderer): void {
    // 直接按列缩放矩阵元素以实现右乘 size 矩阵（column-major）
    this.worldMatrix.copyFrom(this.transform.getWorldMatrix());

    multiplyMatrixByScale(this.worldMatrix, this.transform.size.x, this.transform.size.y);

    renderer.drawGeometry(this.clipGeometry, this.worldMatrix, this.material);
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