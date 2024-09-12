import { serialize } from '../decorators';
import type { Material } from '../material';
import type { Renderer } from '../render';
import { removeItem } from '../utils';
import type { VFXItem } from '../vfx-item';
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

  override setVFXItem (item: VFXItem): void {
    super.setVFXItem(item);
    this.item.rendererComponents.push(this);
  }

  override fromData (data: unknown): void {
    super.fromData(data);
  }

  override toData (): void {
    super.toData();
  }

  override dispose (): void {
    if (this.item) {
      removeItem(this.item.rendererComponents, this);
    }
    super.dispose();
  }
}
