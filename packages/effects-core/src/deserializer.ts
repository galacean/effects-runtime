import type * as spec from '@galacean/effects-specification';
import type { Component } from './components';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import { Geometry } from './render';
import type { VFXItemProps } from './vfx-item';
import { generateUuid } from '.';

/**
 * @since 2.0.0
 * @internal
 */
export class Deserializer {

  private objectInstance: Record<string, EffectsObject> = {};
  private static constructorMap: Record<number, new (engine: Engine) => EffectsObject> = {};

  constructor (
    private engine: Engine,
  ) { }

  static addConstructor (constructor: new (engine: Engine) => EffectsObject | Component, type: number) {
    Deserializer.constructorMap[type] = constructor;
  }

  loadUuid<T> (uuid: string): T {
    if (this.objectInstance[uuid]) {
      return this.objectInstance[uuid] as T;
    }
    let effectsObject: EffectsObject | undefined;
    const effectsObjectData = this.findData(uuid);

    if (!effectsObjectData) {
      console.error('未找到 uuid: ' + uuid + '的对象数据');
    }
    switch (effectsObjectData.dataType) {
      case DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      case DataType.Shader:
        effectsObject = this.engine.getShaderLibrary().createShader(effectsObjectData as ShaderData);

        break;
      default:
        if (Deserializer.constructorMap[effectsObjectData.dataType]) {
          effectsObject = new Deserializer.constructorMap[effectsObjectData.dataType](this.engine);
        }
    }
    if (!effectsObject) {
      console.error('未找到 DataType: ' + effectsObjectData.dataType + '的构造函数');

      return undefined as T;
    }
    this.addInstance(uuid, effectsObject);
    this.deserializeTaggedProperties(effectsObjectData, effectsObject.taggedProperties);
    effectsObject.fromData(effectsObject.taggedProperties as EffectsObjectData);

    return effectsObject as T;
  }

  addInstance (id: string, effectsObject: EffectsObject) {
    this.objectInstance[id] = effectsObject;
  }

  getInstance (id: string) {
    return this.objectInstance[id];
  }

  serializeEffectObject (effectsObject: EffectsObject) {
    const serializableMap: Record<string, EffectsObject> = {};
    const serializedDatas: Record<string, any> = {};

    this.collectSerializableObject(effectsObject, serializableMap);
    for (const value of Object.values(serializableMap)) {
      serializedDatas[value.instanceId] = {};
      this.serializeTaggedProperties(value.taggedProperties, serializedDatas[value.instanceId]);
    }

    return serializedDatas;
  }

  collectSerializableObject (effectsObject: EffectsObject, res: Record<string, EffectsObject>) {
    if (res[effectsObject.instanceId]) {
      return;
    }
    effectsObject.toData();
    res[effectsObject.instanceId] = effectsObject;
    for (const value of Object.values(effectsObject.taggedProperties)) {
      if (value instanceof EffectsObject) {
        this.collectSerializableObject(value, res);
      } else if (value instanceof Array) {
        for (const arrayValue of value) {
          if (arrayValue instanceof EffectsObject) {
            this.collectSerializableObject(arrayValue, res);
          }
        }
      } else if (value instanceof Object) {
        for (const objectValue of Object.values(value)) {
          if (objectValue instanceof EffectsObject) {
            this.collectSerializableObject(objectValue, res);
          }
        }
      }
    }
  }

  deserializeTaggedProperties (serializedData: Record<string, any>, taggedProperties: Record<string, any>) {
    for (const key of Object.keys(serializedData)) {
      const value = serializedData[key];

      taggedProperties[key] = this.deserializeProperty(value, 0);
    }
  }

  serializeTaggedProperties (taggedProperties: Record<string, any>, serializedData: Record<string, any>) {
    for (const key of Object.keys(taggedProperties)) {
      const value = taggedProperties[key];

      serializedData[key] = this.serializeTaggedProperty(value, 0);
    }
  }

  private deserializeProperty<T> (property: T, level: number): any {
    if (level > 10) {
      console.error('序列化数据的内嵌对象层数大于上限');

      return;
    }
    if (typeof property === 'number' ||
    typeof property === 'string' ||
    typeof property === 'boolean') {
      return property;
    } else if (this.checkDataPath(property)) {
      return this.loadUuid((property as DataPath).id);
    } else if (property instanceof Array) {
      const res = [];

      for (const value of property) {
        res.push(this.deserializeProperty(value, level + 1));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (property instanceof EffectsObject || this.checkTypedArray(property)) {
      return property;
    } else if (property instanceof Object) {
      const res: Record<string, any> = {};

      for (const key of Object.keys(property)) {
        // @ts-expect-error
        res[key] = this.deserializeProperty(property[key], level + 1);
      }

      return res;
    }
  }

  private serializeTaggedProperty<T> (property: T, level: number): any {
    if (level > 10) {
      console.error('序列化数据的内嵌对象层数大于上限');

      return;
    }
    if (typeof property === 'number' ||
    typeof property === 'string' ||
    typeof property === 'boolean' ||
    this.checkTypedArray(property)) {
      return property;
    } else if (property instanceof Array) {
      const res = [];

      for (const value of property) {
        res.push(this.serializeTaggedProperty(value, level + 1));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (property instanceof EffectsObject) {
      // TODO 处理 EffectsObject 递归序列化
      return { id: property.instanceId };
    } else if (property instanceof Object) {
      const res: Record<string, any> = {};

      for (const key of Object.keys(property)) {
        // @ts-expect-error
        res[key] = this.serializeTaggedProperty(property[key], level + 1);
      }

      return res;
    }
  }

  private checkTypedArray (obj: any): boolean {
    return obj instanceof Int8Array ||
         obj instanceof Uint8Array ||
         obj instanceof Uint8ClampedArray ||
         obj instanceof Int16Array ||
         obj instanceof Uint16Array ||
         obj instanceof Int32Array ||
         obj instanceof Uint32Array ||
         obj instanceof Float32Array ||
         obj instanceof Float64Array;
  }

  private checkDataPath (value: any): boolean {
    // check value is { id: 7e69662e964e4892ae8933f24562395b }
    return value instanceof Object && Object.keys(value).length === 1 && value.id && value.id.length === 32;
  }

  private findData (uuid: string): EffectsObjectData {
    return this.engine.sceneData[uuid];
  }
}

export class SerializedObject {
  engine: Engine;
  serializedData: Record<string, any>;
  target: EffectsObject;

  constructor (target: EffectsObject) {
    this.target = target;
    this.engine = target.engine;
    this.serializedData = {};
    this.update();
  }

  update () {
    this.target.toData();
    this.engine.deserializer.serializeTaggedProperties(this.target.taggedProperties, this.serializedData);
  }

  applyModifiedProperties () {
    this.engine.deserializer.deserializeTaggedProperties(this.serializedData, this.target.taggedProperties);
    this.target.fromData(this.target.taggedProperties as EffectsObjectData);
  }
}

export enum DataType {
  VFXItemData = 0,
  EffectComponent,
  Material,
  Shader,
  SpriteComponent,
  ParticleSystem,
  InteractComponent,
  CameraController,
  Geometry,

  // FIXME: 先完成ECS的场景转换，后面移到spec中
  MeshComponent = 10000,
  SkyboxComponent,
  LightComponent,
  CameraComponent,
  ModelPluginComponent,
  TreeComponent,
}

export interface DataPath {
  id: string,
}

export interface EffectsObjectData {
  id: string,
  name?: string,
  dataType: DataType,
}

export interface MaterialData extends EffectsObjectData {
  shader: DataPath,
  blending?: boolean,
  zWrite?: boolean,
  zTest?: boolean,
  floats: Record<string, number>,
  ints: Record<string, number>,
  vector2s?: Record<string, spec.vec2>,
  vector3s?: Record<string, spec.vec3>,
  vector4s: Record<string, spec.vec4>,
  matrices?: Record<string, spec.mat4>,
  matrice3s?: Record<string, spec.mat3>,
  textures?: Record<string, DataPath>,
  floatArrays?: Record<string, number[]>,
  vector4Arrays?: Record<string, number[]>,
  matrixArrays?: Record<string, number[]>,
}

export interface GeometryData extends EffectsObjectData {
  vertices?: number[],
  uvs?: number[],
  normals?: number[],
  indices?: number[],
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
