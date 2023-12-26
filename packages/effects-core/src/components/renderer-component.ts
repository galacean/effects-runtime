import type { Material } from '../material';
import type { Renderer } from '../render';
import { removeItem } from '../utils';
import { Component } from './component';

/**
 * 所有渲染组件的基类
 * @since 2.0.0
 */
export class RendererComponent extends Component {
  started = false;
  materials: Material[] = [];

  protected _priority: number;
  private _enabled = true;

  get priority (): number {
    return this._priority;
  }
  set priority (value: number) {
    this._priority = value;
  }

  get enabled () {
    return this._enabled;
  }
  set enabled (value: boolean) {
    this._enabled = value;
    if (value) {
      this.onEnable();
    }
  }

  /**
   * 组件是否可以更新，true 更新，false 不更新
   */
  get isActiveAndEnabled () {
    return this.item.getVisible() && this.enabled;
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

  onEnable () { }

  start () { }

  update (dt: number) { }

  lateUpdate (dt: number) { }

  render (renderer: Renderer): void { }

  override onAttached (): void {
    this.item.rendererComponents.push(this);
  }

  override dispose (): void {
    if (this.item) {
      removeItem(this.item.rendererComponents, this);
    }
    super.dispose();
  }
}
