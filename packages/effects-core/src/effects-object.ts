import type { Deserializer, EffectsObjectData, SceneData } from './deserializer';
import type { Engine } from './engine';

let seed = 0;

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
    this.instanceId = String(seed++);
    this.taggedProperties = {};
  }

  /**
   * 反序列化函数
   *
   * @param deserializer - 反序列化器
   * @param data - 对象的序列化的数据
   * @param sceneData - 场景的序列化数据
   */
  fromData (data: EffectsObjectData, deserializer?: Deserializer, sceneData?: SceneData) {
    this.instanceId = data.id;
  }

  dispose () { }
}
