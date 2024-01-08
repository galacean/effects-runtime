import type * as spec from '@galacean/effects-specification';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import { Material } from './material';
import type { VFXItemProps } from './vfx-item';
import type { ShaderWithSource } from './render';
import { Geometry, Shader } from './render';
import type { Component } from './components';
import { Texture } from './texture';
import { value } from './shader';

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

  deserialize<T> (dataPath: DataPath): T {
    if (this.objectInstance[dataPath.id]) {
      return this.objectInstance[dataPath.id] as T;
    }
    let effectsObject: EffectsObject | undefined;
    const sceneData = this.engine.sceneData;
    const effectsObjectData = this.findData(dataPath, sceneData);

    switch (effectsObjectData.dataType) {
      case DataType.Material:
        effectsObject = Material.create(this.engine);

        break;
      case DataType.Geometry:
        effectsObject = Geometry.create(this.engine);

        break;
      case DataType.Shader:
        return this.engine.getShaderLibrary().createShader(effectsObjectData as ShaderData) as T;
      default:
        if (Deserializer.constructorMap[effectsObjectData.dataType]) {
          effectsObject = new Deserializer.constructorMap[effectsObjectData.dataType](this.engine);
        }
    }

    if (!effectsObject) {
      console.error('未找到 DataType: ' + effectsObjectData.dataType + '的构造函数');
    }

    effectsObject = effectsObject as EffectsObject;

    this.addInstance(dataPath.id, effectsObject);
    this.deserializeTaggedProperties(effectsObjectData, effectsObject.taggedProperties);

    // console.log(effectsObjectData, effectsObject.taggedProperties);

    effectsObject.fromData(effectsObject.taggedProperties as EffectsObjectData, this);

    return effectsObject as T;
  }

  findData (dataPath: DataPath, sceneData: SceneData): EffectsObjectData {
    const data = sceneData[dataPath.id];

    return data;
  }

  addInstance (id: string, effectsObject: EffectsObject) {
    this.objectInstance[id] = effectsObject;
  }

  deserializeTaggedProperties (serializedData: Record<string, any>, taggedProperties: Record<string, any>) {
    for (const key of Object.keys(serializedData)) {
      const value = serializedData[key];

      taggedProperties[key] = this.deserializeProperty(value, 0);
    }
  }

  deserializeProperty<T> (property: T, level: number): any {
    if (level > 10) {
      console.error('序列化数据的内嵌对象层数大于上限');

      return;
    }
    if (typeof property === 'number' ||
    typeof property === 'string' ||
    typeof property === 'boolean') {
      return property;
    } else if (this.checkDataPath(property)) {
      return this.deserialize(property as DataPath);
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

  checkTypedArray (obj: any): boolean {
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
    this.serializeTaggedProperties(this.target.taggedProperties, this.serializedData);
  }

  applyModifiedProperties () {
    this.engine.deserializer.deserializeTaggedProperties(this.serializedData, this.target.taggedProperties);
    this.target.fromData(this.serializedData as EffectsObjectData);
  }

  serializeTaggedProperties (taggedProperties: Record<string, any>, serializedData: Record<string, any>) {

    for (const key of Object.keys(taggedProperties)) {
      const value = taggedProperties[key];

      if (typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean') {
        serializedData[key] = value;
      } else if (value instanceof Array) {
        serializedData[key] = [];
        const target = serializedData[key];

        this.serializeArrayField(value, target);
      } else if (value instanceof EffectsObject) {
        serializedData[key] = { id:value.instanceId };
      } else if (value instanceof Object) {
        serializedData[key] = {};
        const target = serializedData[key];

        this.serializeObjectField(value, target);
      }
    }
  }

  private serializeObjectField (source: any, serializedData: any) {
    for (const key of Object.keys(source)) {
      const value = source[key];

      if (typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean') {
        serializedData[key] = value;
      } else if (value instanceof Array) {
        serializedData[key] = [];
        this.serializeArrayField(value, serializedData[key]);
      } else if (value instanceof EffectsObject) {
        serializedData[key] = { id:value.instanceId };
      } else if (value instanceof Object) {
        serializedData[key] = {};
        this.serializeObjectField(value, serializedData[key]);
      }
    }
  }

  private serializeArrayField (source: any[], serializedData: any[]) {
    for (const value of source) {
      if (typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean') {
        serializedData.push(value);
      } else if (value instanceof Array) {
        const arrayField: any[] = [];

        serializedData.push(arrayField);
        this.serializeArrayField(value, arrayField);
      } else if (value instanceof EffectsObject) {
        serializedData.push({ id:value.instanceId });
      } else if (value instanceof Object) {
        const objectField = {};

        serializedData.push(objectField);
        this.serializeObjectField(value, objectField);
      }
    }
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
  uv?: number[],
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
