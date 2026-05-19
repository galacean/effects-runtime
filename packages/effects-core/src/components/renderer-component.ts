import { serialize } from '../decorators';
import type { Material, Maskable, MaskReference } from '../material';
import { MaskProcessor } from '../material';
import { BoundingBoxInfo } from '../plugins/interact/mesh-collider';
import { Component } from './component';
import type { Renderer } from '../render/renderer';

/**
 * 所有渲染组件的基类
 * @since 2.0.0
 */
export class RendererComponent extends Component {
  @serialize()
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
   * 添加蒙版引用，支持多蒙版
   * 如果重复添加同一个蒙版对象，后续调用会被忽略，不会更新 inverted。
   * 如需切换正向/反向蒙版，请先 removeMask，再重新 addMask。
   * @param maskable - 蒙版对象（实现了 Maskable 接口的组件）
   * @param inverted - 是否反向蒙版（true: 反向遮挡，false: 正向遮挡），默认 false
   */
  addMask (maskable: Maskable, inverted = false): void {
    this.maskManager.addMaskReference(maskable, inverted);
  }

  /**
   * 移除蒙版引用
   * @param maskable - 要移除的蒙版对象
   */
  removeMask (maskable: Maskable): void {
    this.maskManager.removeMaskReference(maskable);
  }

  /**
   * 清空所有蒙版引用
   */
  clearMasks (): void {
    this.maskManager.clearMaskReferences();
  }

  /**
   * 获取当前蒙版引用列表（只读）
   * @returns 蒙版引用列表的只读副本
   */
  getMaskReferences (): ReadonlyArray<MaskReference> {
    return this.maskManager.getMaskReferences();
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
