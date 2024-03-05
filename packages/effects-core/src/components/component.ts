import { serialize } from '../decorators';
import { EffectsObject } from '../effects-object';
import { removeItem } from '../utils';
import type { VFXItem, VFXItemContent } from '../vfx-item';

/**
 * @since 2.0.0
 * @internal
 */
export abstract class Component extends EffectsObject {
  name: string;
  /**
   * 附加到的 VFXItem 对象
   */
  item: VFXItem<VFXItemContent>;
  /**
   * 附加到的 VFXItem 对象 Transform 组件
   */
  get transform () {
    return this.item.transform;
  }

  onAttached () { }
  onDestroy () { }

  override fromData (data: any): void {
    super.fromData(data);
    if (data.item) {
      this.item = data.item;
    }
  }

  override dispose (): void {
    this.onDestroy();
    if (this.item) {
      removeItem(this.item.components, this);
    }
  }
}

/**
 * @since 2.0.0
 * @internal
 */
export abstract class Behaviour extends Component {
  @serialize()
  public _enabled = true;

  /**
   * 组件是否可以更新，true 更新，false 不更新
   */
  get isActiveAndEnabled () {
    return this.item.getVisible() && this.enabled;
  }

  get enabled () {
    return this._enabled;
  }
  set enabled (value: boolean) {
    this._enabled = value;
    if (value) {
      this.onBehaviourEnable();
    }
  }

  protected onBehaviourEnable () { }

  override fromData (data: any): void {
    super.fromData(data);
  }

  override toData (): void {
    super.toData();
  }
}

/**
 * @since 2.0.0
 * @internal
 */
export abstract class ItemBehaviour extends Behaviour {
  started = false;

  // /**
  //  * 生命周期函数，初始化后调用，生命周期内只调用一次
  //  */
  // awake () {
  //   // OVERRIDE
  // }

  /**
   * 在每次设置 enabled 为 true 时触发
   */
  onEnable () { }
  /**
   * 生命周期函数，在第一次 update 前调用，生命周期内只调用一次
   */
  start () {
    // OVERRIDE
  }
  /**
   * 生命周期函数，每帧调用一次
   */
  update (dt: number) {
    // OVERRIDE
  }
  /**
   * 生命周期函数，每帧调用一次，在 update 之后调用
   */
  lateUpdate (dt: number) {
    // OVERRIDE
  }

  override onAttached (): void {
    this.item.itemBehaviours.push(this);
  }

  override dispose (): void {
    if (this.item) {
      removeItem(this.item.itemBehaviours, this);
    }
    super.dispose();
  }

  protected override onBehaviourEnable (): void {
    this.onEnable();
    if (!this.started) {
      this.start();
      this.started = true;
    }
  }
}
