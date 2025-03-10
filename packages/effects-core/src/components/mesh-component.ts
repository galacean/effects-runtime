import { serialize } from '../decorators';
import type { BoundingBoxTriangle, HitTestTriangleParams } from '../plugins';
import { MeshCollider } from '../plugins';
import type { Geometry } from '../render/geometry';
import type { Renderer } from '../render/renderer';
import { RendererComponent } from './renderer-component';

/**
 * Mesh 组件
 */
export class MeshComponent extends RendererComponent {
  /**
   * 渲染的 Geometry
   */
  @serialize()
  public geometry: Geometry;
  /**
   * 用于点击测试的碰撞器
   */
  protected meshCollider = new MeshCollider();

  override render (renderer: Renderer) {
    if (renderer.renderingData.currentFrame.globalUniforms) {
      renderer.setGlobalMatrix('effects_ObjectToWorld', this.transform.getWorldMatrix());
    }
    renderer.drawGeometry(this.geometry, this.material);
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
}
