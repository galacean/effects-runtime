import { serialize } from '../decorators';
import { EffectsObject } from '../effects-object';
import { removeItem } from '../utils';
import type { VFXItem } from '../vfx-item';

/**
 * @since 2.0.0
 */
export abstract class Component extends EffectsObject {
  name: string;
  /**
   * 附加到的 VFXItem 对象
   */
  item: VFXItem;
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
 */
export abstract class Behaviour extends Component {
  isAwakeCalled = false;
  isStartCalled = false;

  @serialize()
  private _enabled = true;

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
      if (this.isActiveAndEnabled) {
        this.onEnable();
      }
      if (!this.isStartCalled) {
        this.start();
        this.isStartCalled = true;
      }
    }
  }

  /**
   * 生命周期函数，初始化后调用，生命周期内只调用一次
   */
  awake () {
    // OVERRIDE
  }

  /**
   * 在每次设置 enabled 为 true 时触发
   */
  onEnable () {
    // OVERRIDE
  }
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
    if (!this.isAwakeCalled) {
      this.awake();
      this.isAwakeCalled = true;
    }
  }

  override dispose (): void {
    if (this.item) {
      removeItem(this.item.itemBehaviours, this);
    }
    super.dispose();
  }
}
