import type * as spec from '@galacean/effects-specification';
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
  /**
   * 存储需要序列化的数据
   */
  defination: Record<string, any>;

  /**
   *
   * @param engine
   */
  constructor (
    public engine: Engine,
  ) {
    this.guid = generateGUID();
    this.defination = {};
    this.engine.addInstance(this);
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
    this.engine.removeInstance(this.guid);
    this.guid = guid;
    this.engine.addInstance(this);
  }

  /**
   *
   */
  toData () { }

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
    this.engine.removeInstance(this.guid);
  }
}
