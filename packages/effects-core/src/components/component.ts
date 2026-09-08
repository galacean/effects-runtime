import type * as spec from '@galacean/effects-specification';
import { EffectsObject } from '../effects-object';
import { removeItem } from '../utils';
import type { VFXItem } from '../vfx-item';

interface ComponentData extends spec.ComponentData {
  _enabled?: boolean,
}

/**
 * @since 2.0.0
 */
export abstract class Component extends EffectsObject {
  name = '';
  /**
   * 附加到的 VFXItem 对象
   */
  item: VFXItem;
  isAwakeCalled = false;
  isStartCalled = false;
  isEnableCalled = false;
  isDuringPlay = false;

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
    return this.enabled && (!this.item || this.item.isActive);
  }

  get enabled () {
    return this._enabled;
  }

  set enabled (value: boolean) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
    if (!this.item || (this.item.isDuringPlay && this.item.isActive)) {
      if (value) {
        if (!this.isEnableCalled) {
          this.start();
          this.enable();
        }
      } else if (this.isEnableCalled) {
        this.disable();
      }
    }
  }

  /**
   * 生命周期函数，加载或挂接后的初始化阶段调用，在 BeginPlay 之前执行
   */
  onAwake () {
    // OVERRIDE
  }

  /**
   * 组件首次启用或重新启用时调用，首次调用在 onStart 之后
   */
  onEnable () {
    // OVERRIDE
  }

  /**
   * 组件禁用或退出运行时调用，回调结束后注销帧更新
   */
  onDisable () {
    // OVERRIDE
  }

  /**
   * 生命周期函数，首次启用时调用一次，不受合成播放暂停状态影响
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
   * 生命周期函数，每帧调用一次，在合成渲染之前调用
   */
  onPreRender (): void {
    // OVERRIDE
  }

  /**
   * 生命周期函数，在组件销毁或所属元素退出运行时调用
   */
  onDestroy () {
    // OVERRIDE
  }

  /**
   * 当属性被动画修改时调用
   */
  onApplyAnimationProperties () {
    // OVERRIDE
  }

  /**
   * 当父级或间接父级发生改变时调用
   */
  onParentChanged () {
    // OVERRIDE
  }

  /**
   * Called when the owning item's sibling order changes.
   */
  onOrderInParentChanged () {
    // OVERRIDE
  }

  /**
   * @internal
   */
  enable () {
    if (this.item?.composition) {
      this.item.composition.sceneTicking.addComponent(this);
      this.isEnableCalled = true;
    }
    this.onEnable();
  }

  /** @internal */
  disable () {
    this.onDisable();
    if (this.item?.composition) {
      this.isEnableCalled = false;
      this.item.composition.sceneTicking.removeComponent(this);
    }
  }

  /** @internal */
  initialize () {
    if (!this.isRegistered) {
      this.registerObject();
    }
    if (!this.isAwakeCalled) {
      this.isAwakeCalled = true;
      this.onAwake();
    }
  }

  /** @internal */
  beginPlay () {
    this.isDuringPlay = true;
  }

  /** @internal */
  endPlay () {
    this.isDuringPlay = false;
    if (this.isRegistered) {
      this.unregisterObject();
    }
  }

  /** Sets the owning item, corresponding to Flax Script.SetActor. */
  setVFXItem (item: VFXItem | null) {
    this.setParent(item);
  }

  /** @internal */
  setParent (item: VFXItem | null) {
    if (this.item === item) {
      return;
    }
    const previous = this.item;

    if (previous) {
      if (!item && previous.isDuringPlay && previous.isActive && this.enabled && this.isEnableCalled) {
        this.disable();
      }
      removeItem(previous.components, this);
    }
    // As during construction, item-dependent APIs require an attached component.
    this.item = item!;
    if (item) {
      item.components.push(this);
    }
    if (item && item.isDuringPlay && !this.isDuringPlay) {
      this.initialize();
      this.beginPlay();
      if (this.enabled) {
        this.start();
        this.enable();
      }
    } else if (!previous && item && item.isDuringPlay && item.isActive && this.enabled) {
      this.enable();
    }
  }

  override toData (): void {
    this.definition = {};
    super.toData();
    this.definition.name = this.name;
    if (this.item) {
      this.definition.item = { id: this.item.getInstanceId() };
    }
  }

  override fromData (data: ComponentData): void {
    super.fromData(data);
    this.name = (data as ComponentData & { name?: string }).name ?? this.name;
    if (data.item !== undefined) {
      this.item = this.engine.findObject<VFXItem>(data.item);
    }
    if (data._enabled !== undefined) {
      this._enabled = data._enabled;
    }
  }

  override dispose (): void {
    if (this.isEnableCalled) {
      this.disable();
    }
    if (this.isAwakeCalled) {
      this.isAwakeCalled = false;
      this.onDestroy();
    }
    if (this.isDuringPlay) {
      this.endPlay();
    }
    this.setParent(null);
    super.dispose();
  }

  /** @internal */
  start () {
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

  override setVFXItem (item: VFXItem | null): void {
    super.setVFXItem(item);
  }

  override dispose (): void {
    super.dispose();
  }
}
