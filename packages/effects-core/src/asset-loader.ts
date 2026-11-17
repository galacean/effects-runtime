import type * as spec from '@galacean/effects-specification';
import { Asset } from './asset';
import { getClass } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { SerializationHelper } from './serialization-helper';
import type { AbstractConstructor, Constructor } from './utils';

/**
 * @since 2.0.0
 */
export class AssetLoader {
  constructor (
    private engine: Engine,
  ) { }

  loadGUID<T> (dataPath: spec.DataPath, type?: AbstractConstructor): T {
    if (!dataPath) {
      return null as T;
    }

    const created = this.createObject(dataPath.id, type);

    if (!created) {
      return undefined as T;
    }
    const { data, instance } = created;

    this.engine.assetServer.addAsset(dataPath.id, instance);
    SerializationHelper.deserialize(data, instance);

    return instance as T;
  }

  /** @internal Create an instance before resolving its serialized references. */
  createObject (id: string, type?: AbstractConstructor): { data: spec.EffectsObjectData, instance: EffectsObject } | undefined {
    const data = this.engine.assetServer.findEffectsObjectData(id);

    if (!data) {
      console.warn(`Object data with uuid: ${id} not found.`);

      return undefined;
    }

    const objectClass: Constructor<EffectsObject> | undefined = getClass(data.dataType);

    if (!objectClass) {
      console.warn(`Constructor for DataType: ${data.dataType} not found.`);

      return undefined;
    }
    if (type) {
      const isAsset = objectClass === Asset || objectClass.prototype instanceof Asset;
      const matchesType = objectClass === type || objectClass.prototype instanceof type;

      if (!isAsset || !matchesType) {
        return undefined;
      }
    }

    return { data, instance: new objectClass(this.engine) };
  }
}

export class Database {
  async loadGUID (guid: string): Promise<EffectsObject | undefined> {
    return undefined;
  }
}

// TODO: 待统一
export interface EffectComponentData extends spec.EffectsObjectData {
  _priority: number,
  item: spec.DataPath,
  materials: spec.DataPath[],
  geometry: spec.DataPath,
}

export type VFXItemData = spec.Item & {
  dataType: spec.DataType,
  components: spec.DataPath[],
};

export type SceneData = Record<string, spec.EffectsObjectData>;

