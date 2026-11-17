import type * as spec from '@galacean/effects-specification';
import type { Engine } from './engine';
import type { AbstractConstructor } from './utils';
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

  protected readonly guid: string;
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

  /** @internal Whether to load a separate copy for each scene hierarchy. */
  get isSceneLocal (): boolean {
    return false;
  }

  /** Resolve an object reference. Returns undefined if the object is missing or the type does not match. */
  findObject<T> (dataPath: spec.DataPath, type?: AbstractConstructor<T>): T {
    return this.engine.effectsObjectServer.findObject<T>(dataPath, type);
  }

  /** @internal */
  registerObject (): void {
    if (this._isRegistered) {
      return;
    }
    this._isRegistered = true;
    this.engine.effectsObjectServer.registerObject(this);
  }

  /** @internal */
  unregisterObject (): void {
    if (!this._isRegistered) {
      return;
    }
    this._isRegistered = false;
    this.engine.effectsObjectServer.unregisterObject(this);
  }

  /**
   *
   * @returns
   */
  getInstanceId () {
    return this.guid;
  }

  /** @deprecated Registers a lookup alias. The instance ID is assigned at construction. */
  setInstanceId (guid: string): void {
    this.engine.assetServer.addAsset(guid, this);
  }

  /**
   *
   */
  toData () { }

  /**
   * 反序列化函数
   *
   * @param _data - 对象的序列化数据
   */
  fromData (_data: spec.EffectsObjectData): void { }

  /**
   * 销毁当前对象
   */
  dispose () {
    this.unregisterObject();
  }
}
