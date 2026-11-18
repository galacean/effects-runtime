import type * as spec from '@galacean/effects-specification';
import { effectsClass } from './decorators';
import { EffectsObject } from './effects-object';
import type { EventEmitterListener } from './events';
import { EventEmitter } from './events';
import { SerializationHelper } from './serialization-helper';

export type AssetEvent = {
  changed: [asset: Asset],
};

export class Asset extends EffectsObject {
  protected readonly eventEmitter = new EventEmitter<AssetEvent>();

  /** Updates the asset data and runtime fields, then emits changed. */
  setData<T extends spec.EffectsObjectData> (data: T): void {
    SerializationHelper.deserialize(data, this);
    this.eventEmitter.emit('changed', this);
  }

  on<E extends keyof AssetEvent> (
    eventName: E,
    listener: EventEmitterListener<AssetEvent[E]>,
  ): void {
    this.eventEmitter.on(eventName, listener);
  }

  off<E extends keyof AssetEvent> (
    eventName: E,
    listener: EventEmitterListener<AssetEvent[E]>,
  ): void {
    this.eventEmitter.off(eventName, listener);
  }
}

@effectsClass('DataAsset')
export class DataAsset<T> extends Asset {
  data: T;

  override fromData (data: spec.EffectsObjectData & { data: T }): void {
    this.data = data.data;
  }
}
