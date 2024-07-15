import type * as spec from '@galacean/effects-specification';
import type { Engine } from './engine';
import { generateGUID } from './utils';
import { serialize } from './decorators';
import { EventEmitter } from './event-emitter';
import type { ItemEffectEvent } from './effect-events';

/**
 * @since 2.0.0
 * @internal
 */
export abstract class EffectsObject extends EventEmitter<ItemEffectEvent> {
  static is (obj: unknown): obj is EffectsObject {
    return obj instanceof EffectsObject && 'guid' in obj;
  }

  @serialize()
  protected guid: string;
  /**
   * 存储需要序列化的数据
   */
  readonly taggedProperties: Record<string, any>;

  constructor (
    public engine: Engine,
  ) {
    super();
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

  toData () { }

  /**
   * 反序列化函数
   *
   * @param data - 对象的序列化的数据
   */
  fromData (data: spec.EffectsObjectData) {
    if (data.id) {
      this.setInstanceId(data.id);
    }
  }

  dispose () { }
}
