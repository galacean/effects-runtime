import { serialize } from '../decorators';
import type { Maskable, Material } from '../material';
import { MaskProcessor } from '../material';
import type { Renderer } from '../render';
import { Component } from './component';

/**
 * 所有渲染组件的基类
 * @since 2.0.0
 */
export class RendererComponent extends Component {
  @serialize()
  materials: Material[] = [];
  /**
   * @internal
   */
  frameClipMask: Maskable | null = null;
  /**
   * @internal
   */
  maskManager: MaskProcessor = new MaskProcessor();

  @serialize()
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

  render (renderer: Renderer): void {
    // OVERRIDE
  }
}
