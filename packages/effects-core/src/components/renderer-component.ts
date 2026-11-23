import { Box3 } from '@galacean/effects-math/es/core/box3';
import type * as spec from '@galacean/effects-specification';
import type { Material, Maskable } from '../material';
import { MaskProcessor } from '../material';
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
      this.materials = data.materials.map(material => this.findObject<Material>(material));
    }
    if (data._priority !== undefined) {
      this._priority = data._priority;
    }
  }

  override onEnable (): void {
    this.item.composition?.sceneRendering.addRenderer(this);
  }

  override onDisable (): void {
    this.item.composition?.sceneRendering.removeRenderer(this);
  }

  override onParentChanged (): void {
    this.frameClipMasks = [];
  }

  /** 元素局部坐标系中的几何边界，不含描边。没有可用几何时返回空盒。 */
  getBoundingBox (out = new Box3()): Box3 {
    return out.makeEmpty();
  }

  /** 同一局部坐标系中的渲染边界，包含描边等绘制范围。 */
  getRenderBounds (out = new Box3()): Box3 {
    return this.getBoundingBox(out);
  }

  render (renderer: Renderer): void {
    // OVERRIDE
  }
}
