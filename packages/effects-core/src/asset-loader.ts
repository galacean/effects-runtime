import * as spec from '@galacean/effects-specification';
import { effectsClassStore } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import { Geometry } from './render';
import { SerializationHelper } from './serialization-helper';
import { Texture } from './texture';
import type { Constructor } from './utils';

/**
 * @since 2.0.0
 */
export class AssetLoader {
  constructor (
    private engine: Engine,
  ) { }

  loadGUID<T> (dataPath: spec.DataPath): T {
    const guid = dataPath.id;

    if (!dataPath) {
      return null as T;
    }

    const effectsObjectData = this.findData(guid);
    let effectsObject: EffectsObject | undefined;

    if (!effectsObjectData) {
      console.error(`Object data with uuid: ${guid} not found.`);

      return undefined as T;
    }

    switch (effectsObjectData.dataType) {
      case spec.DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case spec.DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      case spec.DataType.Texture:
        effectsObject = Texture.create(this.engine);

        break;
      default: {
        const classConstructor = AssetLoader.getClass(effectsObjectData.dataType);

        if (classConstructor) {
          effectsObject = new classConstructor(this.engine);
        }
      }
    }

    if (!effectsObject) {
      console.error(`Constructor for DataType: ${effectsObjectData.dataType} not found.`);

      return undefined as T;
    }

    effectsObject.setInstanceId(effectsObjectData.id);
    this.engine.addInstance(effectsObject);
    SerializationHelper.deserialize(effectsObjectData, effectsObject);

    return effectsObject as T;
  }

  private findData (uuid: string): spec.EffectsObjectData | undefined {
    return this.engine.jsonSceneData[uuid];
  }

  private static getClass (dataType: string): Constructor<EffectsObject> {
    return effectsClassStore[dataType];
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

