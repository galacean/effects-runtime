import { serialize } from '../decorators';
import type { Material } from '../material';
import { BoundingBoxInfo } from '../plugins/interact/mesh-collider';
import type { Renderer } from '../render';
import { Component } from './component';

/**
 * 所有渲染组件的基类
 * @since 2.0.0
 */
export class RendererComponent extends Component {

  @serialize()
  materials: Material[] = [];

  @serialize()
  protected _priority = 0;
  /**
   * 用于点击测试的碰撞器
   */
  protected boundingBoxInfo = new BoundingBoxInfo();

  get priority (): number {
    return this._priority;
  }
  set priority (value: number) {
    this._priority = value;
  }

  get material (): Material {
    return this.materials[0];
  }
  set material (material: Material) {
    if (this.materials.length === 0) {
      this.materials.push(material);
    } else {
      this.materials[0] = material;
    }
  }

  render (renderer: Renderer): void { }

  override onEnable (): void {
    this.item.composition?.renderFrame.addMeshToDefaultRenderPass(this);
  }

  override onDisable (): void {
    this.item.composition?.renderFrame.removeMeshFromDefaultRenderPass(this);
  }

  /**
   * 获取包围盒信息
   */
  getBoundingBoxInfo (): BoundingBoxInfo {
    return this.boundingBoxInfo;
  }
}
