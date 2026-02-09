import { serialize } from '../decorators';
import type { Engine } from '../engine';
import type { Maskable } from '../material/types';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { MeshCollider } from '../plugins';
import type { Geometry } from '../render/geometry';
import type { Renderer } from '../render/renderer';
import { RendererComponent } from './renderer-component';

/**
 * Mesh 组件
 */
export class MeshComponent extends RendererComponent implements Maskable {
  /**
   * 渲染的 Geometry
   */
  @serialize()
  protected geometry: Geometry;
  /**
   * 用于点击测试的碰撞器
   */
  protected meshCollider = new MeshCollider();

  constructor (engine: Engine) {
    super(engine);
  }

  override render (renderer: Renderer) {
    this.maskManager.drawStencilMask(renderer, this);

    for (let i = 0;i < this.materials.length;i++) {
      const material = this.materials[i];

      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), material, i);
    }
  }

  drawStencilMask (maskRef: number): void {
    if (!this.isActiveAndEnabled) {
      return;
    }

    for (let i = 0;i < this.materials.length;i++) {
      const material = this.materials[i];

      this.maskManager.drawGeometryMask(this.engine.renderer, this.geometry, this.transform.getWorldMatrix(), material, maskRef, i);
    }
  }

  // TODO 点击测试后续抽象一个 Collider 组件
  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => {
    const worldMatrix = this.transform.getWorldMatrix();

    this.meshCollider.setGeometry(this.geometry, worldMatrix);
    const area = this.meshCollider.getBoundingBoxData();

    if (area) {
      return {
        type: area.type,
        triangles: area.area,
      };
    }
  };

  getBoundingBox (): BoundingBoxTriangle | void {
    const worldMatrix = this.transform.getWorldMatrix();

    this.meshCollider.setGeometry(this.geometry, worldMatrix);
    const boundingBox = this.meshCollider.getBoundingBox();

    return boundingBox;
  }

  // TODO: Update data spec
  override fromData (data: any): void {
    super.fromData(data);

    const maskableRendererData = data;
    const maskOptions = maskableRendererData.mask;

    if (maskOptions) {
      this.maskManager.setMaskOptions(this.engine, maskOptions);
    }
  }
}
