import { EffectsObject } from './effects-object';
import { EventEmitter } from './events';
import type { EventEmitterListener } from './events';
import { SerializationHelper } from './serialization-helper';

export type AssetEvent = {
  changed: [asset: Asset],
};

export class Asset extends EffectsObject {
  private readonly assetEventEmitter = new EventEmitter<AssetEvent>();

  on<E extends keyof AssetEvent> (event: E, listener: EventEmitterListener<AssetEvent[E]>): () => void {
    return this.assetEventEmitter.on(event, listener);
  }

  off<E extends keyof AssetEvent> (event: E, listener: EventEmitterListener<AssetEvent[E]>): void {
    this.assetEventEmitter.off(event, listener);
  }

  /** 替换当前资产数据，在子类解析完成后通知使用方。资产 ID 保持不变。 */
  setData (data: Parameters<this['fromData']>[0]): void {
    if (data.id !== this.getInstanceId()) {
      throw new Error('Cannot change asset ID with setData().');
    }
    SerializationHelper.deserialize(data, this);
    this.emitChanged();
  }

  protected emitChanged (): void {
    this.assetEventEmitter.emit('changed', this);
  }
}

export class DataAsset<T> extends Asset {
  data: T;
}
