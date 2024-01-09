import { generateUuid } from '.';
import type { EffectsObjectData } from './deserializer';
import type { Engine } from './engine';

/**
 * @since 2.0.0
 * @internal
 */
export abstract class EffectsObject {
  instanceId: string;
  taggedProperties: Record<string, any>;

  constructor (
    public engine: Engine,
  ) {
    this.instanceId = generateUuid();
    this.taggedProperties = {};
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
      this.instanceId = data.id;
    }
  }

  dispose () { }
}
