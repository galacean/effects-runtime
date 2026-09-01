import type * as spec from '@galacean/effects-specification';
import type { Material, Maskable } from '../material';
import { MaskProcessor } from '../material';
import { BoundingBoxInfo } from '../plugins/interact/mesh-collider';
import { Component } from './component';
import type { Renderer } from '../render/renderer';

interface RendererComponentData extends spec.ComponentData {
  materials?: spec.DataPath[],
  _priority?: number,
}

/**
 * 所有渲染组件的基类
 * @since 2.0.0
 */
export class RendererComponent extends Component {
  materials: Material[] = [];

  /**
   * @hidden
   * Internal utility.
   * Not part of the public API — do not rely on this in your code.
   */
  frameClipMasks: Maskable[] = [];

  /**
   * @hidden
   * Internal utility.
   * Not part of the public API — do not rely on this in your code.
   */
  maskManager: MaskProcessor = new MaskProcessor();

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

  override fromData (data: RendererComponentData): void {
    super.fromData(data);
    if (data.materials !== undefined) {
      this.materials = data.materials.map(material => this.engine.findObject<Material>(material));
    }
    if (data._priority !== undefined) {
      this._priority = data._priority;
    }
  }

  override onEnable (): void {
    this.item.composition?.renderFrame.addMeshToDefaultRenderPass(this);
  }

  override onDisable (): void {
    this.item.composition?.renderFrame.removeMeshFromDefaultRenderPass(this);
  }

  override onParentChanged (): void {
    this.frameClipMasks = [];
  }

  /**
   * 获取包围盒信息
   */
  getBoundingBoxInfo (): BoundingBoxInfo {
    return this.boundingBoxInfo;
  }

  render (renderer: Renderer): void {
    // OVERRIDE
  }
}
