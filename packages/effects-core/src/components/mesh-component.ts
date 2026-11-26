import type * as spec from '@galacean/effects-specification';
import { Box3 } from '@galacean/effects-math/es/core/box3';
import type { Engine } from '../engine';
import type { Maskable } from '../material';
import type { HitTestTriangleParams } from '../plugins/interact/click-handler';
import { HitTestType } from '../plugins/interact/click-handler';
import type { Geometry, Renderer } from '../render';
import { getWorldTriangles } from '../render/geometry-triangles';
import { RendererComponent } from './renderer-component';

interface MeshComponentData extends Omit<spec.MaskableGraphicData, 'renderer'> {
  geometry?: spec.DataPath,
}

/**
 * Mesh 组件
 */
export class MeshComponent extends RendererComponent implements Maskable {
  /**
   * 渲染的 Geometry
   */
  protected geometry: Geometry;

  constructor (engine: Engine) {
    super(engine);
  }

  override render (renderer: Renderer) {
    this.maskProcessor.applyMasks(renderer, this);

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

      this.maskProcessor.drawStencilGeometry(this.engine.renderer, this.geometry, this.transform.getWorldMatrix(), material, maskRef, i);
    }
  }

  // TODO 点击测试后续抽象一个 Collider 组件
  getHitTestParams = (force?: boolean): HitTestTriangleParams | void => ({
    type: HitTestType.triangle,
    triangles: getWorldTriangles(this.geometry, this.transform.getWorldMatrix()),
    clipMasks: this.frameClipMasks,
  });

  override getBoundingBox (out = new Box3()): Box3 {
    return this.geometry?.getBoundingBox(out) ?? out.makeEmpty();
  }

  override fromData (data: MeshComponentData): void {
    super.fromData(data);

    if (data.geometry !== undefined) {
      this.geometry = this.findObject<Geometry>(data.geometry);
    }
  }
}
