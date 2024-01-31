import type { EffectsObjectData } from './deserializer';
import type { Engine } from './engine';
import { generateGUID } from './utils';

/**
 * @since 2.0.0
 * @internal
 */
export abstract class EffectsObject {
  protected guid: string;
  taggedProperties: Record<string, any>;

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

  setInstanceId (id: string) {
    this.engine.removeInstance(this.guid);
    this.guid = id;
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
