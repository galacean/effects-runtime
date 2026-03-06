import { serialize } from '../decorators';
import type { Engine } from '../engine';
import type { Maskable } from '../material';
import { extractMinAndMax } from '../math';
import type { BoundingBoxTriangle, HitTestTriangleParams, BoundingBoxInfo } from '../plugins';
import type { Geometry, Renderer } from '../render';
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

  constructor (engine: Engine) {
    super(engine);
  }

  override render (renderer: Renderer) {
    this.maskManager.drawStencilMask(renderer, this);

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i];

      renderer.drawGeometry(this.geometry, this.transform.getWorldMatrix(), material, i);
    }
  }

  drawStencilMask (maskRef: number): void {
    if (!this.isActiveAndEnabled) {
      return;
    }

    for (let i = 0; i < this.materials.length; i++) {
      const material = this.materials[i];

      this.maskManager.drawGeometryMask(this.engine.renderer, this.geometry, this.transform.getWorldMatrix(), material, maskRef, i);
    }
  }

  // TODO 点击测试后续抽象一个 Collider 组件
  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => {
    const worldMatrix = this.transform.getWorldMatrix();

    this.boundingBoxInfo.setGeometry(this.geometry, worldMatrix);
    const area = this.boundingBoxInfo.getRawBoundingBoxTriangle();

    if (area) {
      return {
        type: area.type,
        triangles: area.area,
        clipMasks:this.frameClipMasks,
      };
    }
  };

  getBoundingBox (): BoundingBoxTriangle | void {
    const worldMatrix = this.transform.getWorldMatrix();

    this.boundingBoxInfo.setGeometry(this.geometry, worldMatrix);
    const boundingBox = this.boundingBoxInfo.getBoundingBoxTriangle();

    return boundingBox;
  }

  override getBoundingBoxInfo (): BoundingBoxInfo {
    const positionArray = this.geometry.getAttributeData('aPos') as Float32Array;

    if (positionArray) {
      const minMaxResult = extractMinAndMax(positionArray, 0, positionArray.length / 3,);

      minMaxResult.minimum.x *= this.transform.size.x;
      minMaxResult.minimum.y *= this.transform.size.y;
      minMaxResult.maximum.x *= this.transform.size.x;
      minMaxResult.maximum.y *= this.transform.size.y;
      this.boundingBoxInfo.reConstruct(minMaxResult.minimum, minMaxResult.maximum, this.transform.getWorldMatrix());
    }

    return this.boundingBoxInfo;
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
