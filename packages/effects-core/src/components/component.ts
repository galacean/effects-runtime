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
  @serialize()
  item: VFXItem;
  isAwakeCalled = false;
  isStartCalled = false;
  isEnableCalled = false;

  @serialize()
  private _enabled = true;

  /**
   * 附加到的 VFXItem 对象 Transform 组件
   */
  get transform () {
    return this.item.transform;
  }

  /**
   * 组件是否可以更新，true 更新，false 不更新
   */
  get isActiveAndEnabled () {
    return this.item.isActive && this.enabled;
  }

  get enabled () {
    return this._enabled;
  }

  set enabled (value: boolean) {
    if (this.enabled !== value) {
      this._enabled = value;
      if (value) {
        if (this.isActiveAndEnabled) {
          this.enable();
          if (!this.isStartCalled) {
            this.onStart();
            this.isStartCalled = true;
          }
        }
      } else {
        if (this.isEnableCalled) {
          this.disable();
        }
      }
    }
  }

  /**
   * 生命周期函数，初始化后调用，生命周期内只调用一次
   */
  onAwake () {
    // OVERRIDE
  }

  /**
   * 在 enabled 变为 true 时触发
   */
  onEnable () {
    // OVERRIDE
  }

  /**
   * 在 enabled 变为 false 时触发
   */
  onDisable () {
    // OVERRIDE
  }

  /**
   * 生命周期函数，在第一次 update 前调用，生命周期内只调用一次
   */
  onStart () {
    // OVERRIDE
  }

  /**
   * 生命周期函数，每帧调用一次
   */
  onUpdate (dt: number) {
    // OVERRIDE
  }

  /**
   * 生命周期函数，每帧调用一次，在 update 之后调用
   */
  onLateUpdate (dt: number) {
    // OVERRIDE
  }

  /**
   * 生命周期函数，在组件销毁时调用
   */
  onDestroy () {
    // OVERRIDE
  }

  /**
   * @internal
   */
  enable () {
    if (this.item.composition) {
      this.item.composition.sceneTicking.addComponent(this);
      this.isEnableCalled = true;
    }
    this.onEnable();
  }

  /**
   * @internal
   */
  disable () {
    this.onDisable();
    if (this.item.composition) {
      this.isEnableCalled = false;
      this.item.composition.sceneTicking.removeComponent(this);
    }
  }

  setVFXItem (item: VFXItem) {
    this.item = item;
    if (item.isDuringPlay) {
      if (!this.isAwakeCalled) {
        this.onAwake();
        this.isAwakeCalled = true;
      }
      if (item.isActive && this.enabled) {
        this.start();
        this.enable();
      }
    }
  }

  override fromData (data: any): void {
    super.fromData(data);
  }

  override dispose (): void {
    if (this.isEnableCalled) {
      this.disable();
    }
    if (this.isAwakeCalled) {
      this.isAwakeCalled = false;
      this.onDestroy();
    }
    if (this.item) {
      removeItem(this.item.components, this);
    }
  }

  private start () {
    if (this.isStartCalled) {
      return;
    }
    this.isStartCalled = true;
    this.onStart();
  }
}

/**
 * @since 2.0.0
 * @deprecated 2.4.0 Please use Component instead
 */
export abstract class Behaviour extends Component {

  override setVFXItem (item: VFXItem): void {
    super.setVFXItem(item);
  }

  override dispose (): void {
    super.dispose();
  }
}
