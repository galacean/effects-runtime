import type * as spec from '@galacean/effects-specification';
import { getEffectsClassName } from './decorators';
import type { Constructor } from './utils';
import type { Engine } from './engine';
import { generateGUID } from './utils';

/**
 * @since 2.0.0
 */
export abstract class EffectsObject {
  /**
   *
   * @param obj
   * @returns
   */
  static is (obj: unknown): obj is EffectsObject {
    return obj instanceof EffectsObject && 'guid' in obj;
  }

  protected guid: string;
  private _isRegistered = false;
  /**
   * 存储需要序列化的数据
   */
  definition: Record<string, any>;

  /**
   *
   * @param engine
   */
  constructor (
    public engine: Engine,
  ) {
    this.guid = generateGUID();
    this.definition = {};
    this.registerObject();
  }

  /** Whether this object is registered for lookup by its instance ID. */
  get isRegistered (): boolean {
    return this._isRegistered;
  }

  /** @internal */
  registerObject (): void {
    if (this._isRegistered) {
      return;
    }
    this._isRegistered = true;
    this.engine.addInstance(this);
  }

  /** @internal */
  unregisterObject (): void {
    if (!this._isRegistered) {
      return;
    }
    this._isRegistered = false;
    this.engine.removeInstance(this.guid);
  }

  /**
   *
   * @returns
   */
  getInstanceId () {
    return this.guid;
  }

  /**
   *
   * @param guid
   */
  setInstanceId (guid: string) {
    if (this.guid === guid) {
      return;
    }
    const wasRegistered = this.isRegistered;

    if (wasRegistered) {
      this.unregisterObject();
    }
    this.guid = guid;
    if (wasRegistered) {
      this.registerObject();
    }
  }

  /**
   *
   */
  toData () {
    this.definition = {
      ...this.definition,
      id: this.getInstanceId(),
      dataType: getEffectsClassName(this.constructor as Constructor<EffectsObject>) ?? this.definition.dataType,
    };
  }

  /**
   * 反序列化函数
   *
   * @param data - 对象的序列化的数据
   */
  fromData (data: spec.EffectsObjectData) {
    if (data.id !== undefined) {
      this.setInstanceId(data.id);
    }
  }

  /**
   * 销毁当前对象
   */
  dispose () {
    this.unregisterObject();
  }
}
