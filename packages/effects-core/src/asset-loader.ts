import { effectsClassStore } from './decorators';
import type { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import type { ShaderMarcos } from './render';
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
      console.error('未找到 uuid: ' + guid + '的对象数据');

      return undefined as T;
    }
    switch (effectsObjectData.dataType) {
      case DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      case DataType.Texture:
        effectsObject = Texture.create(this.engine, effectsObjectData);

        return effectsObject as T;

        break;
      default: {
        const classConstructor = AssetLoader.getClass(effectsObjectData.dataType);

        if (classConstructor) {
          effectsObject = new classConstructor(this.engine);
        }
      }
    }
    if (!effectsObject) {
      console.error('未找到 DataType: ' + effectsObjectData.dataType + '的构造函数');

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
        console.error('未找到 uuid: ' + guid + '的对象数据');

        return undefined as T;
      }

      effectsObject = await this.engine.database.loadGUID(guid);
      if (!effectsObject) {
        console.error('未找到 uuid: ' + guid + '的磁盘数据');

        return undefined as T;
      }

      this.engine.addInstance(effectsObject);

      return effectsObject as T;
    }

    switch (effectsObjectData.dataType) {
      case DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      case DataType.Texture:
        effectsObject = Texture.create(this.engine, effectsObjectData);

        return effectsObject as T;

        break;
      default: {
        const classConstructor = AssetLoader.getClass(effectsObjectData.dataType);

        if (classConstructor) {
          effectsObject = new classConstructor(this.engine);
        }
      }
    }
    if (!effectsObject) {
      console.error('未找到 DataType: ' + effectsObjectData.dataType + '的构造函数');

      return undefined as T;
    }
    effectsObject.setInstanceId(effectsObjectData.id);
    this.engine.addInstance(effectsObject);
    await SerializationHelper.deserializeTaggedPropertiesAsync(effectsObjectData, effectsObject);

    return effectsObject as T;
  }

  private findData (uuid: string): EffectsObjectData | undefined {
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

export enum DataType {
  VFXItemData = 'VFXItemData',
  EffectComponent = 'EffectComponent',
  Material = 'Material',
  Shader = 'Shader',
  SpriteComponent = 'SpriteComponent',
  ParticleSystem = 'ParticleSystem',
  InteractComponent = 'InteractComponent',
  CameraController = 'CameraController',
  Geometry = 'Geometry',
  Texture = 'Texture',
  TextComponent = 'TextComponent',

  // FIXME: 先完成ECS的场景转换，后面移到spec中
  MeshComponent = 'MeshComponent',
  SkyboxComponent = 'SkyboxComponent',
  LightComponent = 'LightComponent',
  CameraComponent = 'CameraComponent',
  ModelPluginComponent = 'ModelPluginComponent',
  TreeComponent = 'TreeComponent',
}

export interface DataPath {
  id: string,
}

export interface EffectsObjectData {
  id: string,
  name?: string,
  dataType: string,
}

export interface ColorData {
  r: number,
  g: number,
  b: number,
  a: number,
}

export interface Vector4Data {
  x: number,
  y: number,
  z: number,
  w: number,
}

export interface Vector2Data {
  x: number,
  y: number,
}

export interface MaterialTextureProperty {
  texture: DataPath,
  offset: Vector2Data,
  scale: Vector2Data,
}

export interface MaterialData extends EffectsObjectData {
  shader: DataPath,
  blending?: boolean,
  zWrite?: boolean,
  zTest?: boolean,
  ints: Record<string, number>,
  floats: Record<string, number>,
  vector4s: Record<string, Vector4Data>,
  colors: Record<string, ColorData>,
  textures: Record<string, MaterialTextureProperty>,
  /**
   * shader的宏定义
   */
  marcos?: ShaderMarcos,
}

export interface GeometryData extends EffectsObjectData {
  vertexData: VertexData,
  indexFormat: number,
  indexOffset: number,
  buffer: string,
}

export interface VertexData {
  vertexCount: number,
  channels: VertexChannel[],
}

export interface VertexChannel {
  offset: number,
  format: number,
  dimension: number,
}

export interface ShaderData extends EffectsObjectData {
  vertex: string,
  fragment: string,
  properties?: string,
}

export interface EffectComponentData extends EffectsObjectData {
  _priority: number,
  item: DataPath,
  materials: DataPath[],
  geometry: DataPath,
}

export type VFXItemData = VFXItemProps & { dataType: DataType, components: DataPath[] };

export type SceneData = Record<string, EffectsObjectData>;

export interface EffectsPackageData {
  fileSummary: { guid: string, assetType: string },
  exportObjects: EffectsObjectData[],
}
