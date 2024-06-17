import * as spec from '@galacean/effects-specification';
import { effectsClassStore } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import { Geometry } from './render';
import { SerializationHelper } from './serialization-helper';
import { Texture } from './texture';
import type { VFXItemProps } from './vfx-item';

/**
 * @since 2.0.0
 * @internal
 */
export class AssetLoader {
  constructor (
    private engine: Engine,
  ) { }

  loadGUID<T> (guid: string): T {
    if (this.engine.objectInstance[guid]) {
      return this.engine.objectInstance[guid] as T;
    }
    let effectsObject: EffectsObject | undefined;
    const effectsObjectData = this.findData(guid);

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
    SerializationHelper.deserializeTaggedProperties(effectsObjectData, effectsObject);

    return effectsObject as T;
  }

  // 加载本地文件资产
  async loadGUIDAsync<T> (guid: string): Promise<T> {
    if (this.engine.objectInstance[guid]) {
      return this.engine.objectInstance[guid] as T;
    }
    let effectsObject: EffectsObject | undefined;
    const effectsObjectData = this.findData(guid);

    if (!effectsObjectData) {
      if (!this.engine.database) {
        console.error(`Object data with uuid: ${guid} not found.`);

        return undefined as T;
      }

      effectsObject = await this.engine.database.loadGUID(guid);
      if (!effectsObject) {
        console.error(`Disk data with uuid: ${guid} not found.`);

        return undefined as T;
      }

      this.engine.addInstance(effectsObject);

      return effectsObject as T;
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
    await SerializationHelper.deserializeTaggedPropertiesAsync(effectsObjectData, effectsObject);

    return effectsObject as T;
  }

  private findData (uuid: string): spec.EffectsObjectData | undefined {
    return this.engine.jsonSceneData[uuid];
  }

  private static getClass (dataType: string): new (engine: Engine) => EffectsObject {
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

export type VFXItemData = VFXItemProps & { dataType: spec.DataType, components: spec.DataPath[] };

export type SceneData = Record<string, spec.EffectsObjectData>;

