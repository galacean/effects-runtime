import type { EffectsObjectData } from './asset-loader';
import type { Engine } from './engine';
import { generateGUID } from './utils';
import { serialize } from './decorators';

/**
 * @since 2.0.0
 * @internal
 */
export abstract class EffectsObject {
  @serialize()
  protected guid: string;
  /**
   * 存储需要序列化的数据
   */
  readonly taggedProperties: Record<string, any>;

  constructor (
    public engine: Engine,
  ) {
    this.guid = generateGUID();
    this.taggedProperties = {};
    this.engine.addInstance(this);
  }

  getInstanceId () {
    return this.guid;
  }

  setInstanceId (guid: string) {
    this.engine.removeInstance(this.guid);
    this.guid = guid;
    this.engine.addInstance(this);
  }

  toData () {}

  /**
   * 反序列化函数
   *
   * @param data - 对象的序列化的数据
   * @param deserializer - 反序列化器
   */
  fromData (data: EffectsObjectData) {
    if (data.id) {
      this.setInstanceId(data.id);
    }
  }

  dispose () { }
}
