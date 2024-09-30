import type * as spec from '@galacean/effects-specification';
import { getMergedStore } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import type { Constructor } from './utils';
import { isArray, isCanvas, isObject, isString } from './utils';

export class SerializationHelper {
  static collectSerializableObject (
    effectsObject: EffectsObject,
    res: Record<string, EffectsObject>,
  ) {
    if (res[effectsObject.getInstanceId()]) {
      return;
    }

    effectsObject.toData();
    res[effectsObject.getInstanceId()] = effectsObject;

    const serializedProperties = getMergedStore(effectsObject);

    if (serializedProperties) {
      for (const key of Object.keys(serializedProperties)) {
        // TODO 待移除，序列化属性通过 effectsObject 对象直接获取
        let value = effectsObject.taggedProperties[key];

        if (value === undefined) {
          value = effectsObject[key as keyof EffectsObject];
        }

        if (EffectsObject.is(value)) {
          SerializationHelper.collectSerializableObject(value, res);
        } else if (isArray(value)) {
          for (const arrayValue of value) {
            if (EffectsObject.is(arrayValue)) {
              SerializationHelper.collectSerializableObject(arrayValue, res);
            }
          }
        } else if (isObject(value)) {
          // 非 EffectsObject 对象只递归一层
          for (const objectKey of Object.keys(value)) {
            const objectValue = value[objectKey];

            if (EffectsObject.is(objectValue)) {
              SerializationHelper.collectSerializableObject(objectValue, res);
            }
          }
        }
      }
    }
  }

  static serializeEffectObject (effectsObject: EffectsObject) {
    // 持有所有需要序列化的引擎对象
    const serializableMap: Record<string, EffectsObject> = {};
    const engine = effectsObject.engine;

    // 加入内存中已加载的资产数据，避免重复创建资产数据
    const serializedDatas: Record<string, any> = {
      ...engine.jsonSceneData,
    };

    // 递归收集所有需要序列化的对象
    SerializationHelper.collectSerializableObject(effectsObject, serializableMap);

    // 依次序列化
    for (const guid of Object.keys(serializableMap)) {
      const serializeObject = serializableMap[guid];

      if (!serializedDatas[serializeObject.getInstanceId()]) {
        serializedDatas[serializeObject.getInstanceId()] = {};
      }
      SerializationHelper.serialize(serializeObject, serializedDatas[serializeObject.getInstanceId()]);
    }

    return serializedDatas;
  }

  static serialize (
    effectsObject: EffectsObject,
    serializedData?: Record<string, any>,
  ) {
    effectsObject.toData();

    if (!serializedData) {
      serializedData = {};
    }

    const serializedProperties = getMergedStore(effectsObject);

    if (serializedProperties) {
      for (const key of Object.keys(serializedProperties)) {
        const value = effectsObject[key as keyof EffectsObject];

        if (
          typeof value === 'number' ||
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          SerializationHelper.checkTypedArray(value)
        ) {
          // TODO json 数据避免传 typedArray
          serializedData[key] = value;
        } else if (isArray(value)) {
          if (!serializedData[key]) {
            serializedData[key] = [];
          }
          SerializationHelper.serializeArrayProperty(value, serializedData[key], 0);
        } else if (EffectsObject.is(value)) {
          // TODO 处理 EffectsObject 递归序列化
          serializedData[key] = { id: value.getInstanceId() };
        } else if (isObject(value)) {
          if (!serializedData[key]) {
            serializedData[key] = {};
          }
          SerializationHelper.serializeObjectProperty(value, serializedData[key], 0);
        }
      }
    }

    // TODO 待移除 tagggedProperties 为没有装饰器的临时方案
    for (const key of Object.keys(effectsObject.taggedProperties)) {
      const value = effectsObject.taggedProperties[key];

      if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        SerializationHelper.checkTypedArray(value)
      ) {
        // TODO json 数据避免传 typedArray
        serializedData[key] = value;
      } else if (isArray(value)) {
        if (!serializedData[key]) {
          serializedData[key] = [];
        }
        SerializationHelper.serializeArrayProperty(value, serializedData[key], 0);
      } else if (EffectsObject.is(value)) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[key] = { id: value.getInstanceId() };
      } else if (isObject(value)) {
        if (!serializedData[key]) {
          serializedData[key] = {};
        }
        SerializationHelper.serializeObjectProperty(value, serializedData[key], 0);
      }
    }

    return serializedData;
  }

  static deserialize (
    serializedData: spec.EffectsObjectData,
    effectsObject: EffectsObject,
  ) {
    const taggedProperties = effectsObject.taggedProperties;
    const serializedProperties = getMergedStore(effectsObject);
    const engine = effectsObject.engine;

    for (const key of Object.keys(serializedData)) {
      if (serializedProperties && serializedProperties[key]) {
        continue;
      }
      const value = serializedData[key as keyof spec.EffectsObjectData];

      taggedProperties[key] = SerializationHelper.deserializeProperty(value, engine, 0);
    }

    if (serializedProperties) {
      for (const key of Object.keys(serializedProperties)) {
        const value = serializedData[key as keyof spec.EffectsObjectData];

        if (value === undefined) {
          continue;
        }

        const propertyType = serializedProperties[key].type;

        // FIXME: taggedProperties 为 readonly，这里存在强制赋值
        // @ts-expect-error
        effectsObject[key as keyof EffectsObject] = SerializationHelper.deserializeProperty(value, engine, 0, propertyType);
      }
    }
    effectsObject.fromData(taggedProperties as spec.EffectsObjectData);
  }

  static async deserializeAsync (
    serializedData: spec.EffectsObjectData,
    effectsObject: EffectsObject,
  ) {
    const taggedProperties = effectsObject.taggedProperties;
    const serializedProperties = getMergedStore(effectsObject);
    const engine = effectsObject.engine;

    for (const key of Object.keys(serializedData)) {
      if (serializedProperties && serializedProperties[key]) {
        continue;
      }
      const value = serializedData[key as keyof spec.EffectsObjectData];

      taggedProperties[key] = await SerializationHelper.deserializePropertyAsync(value, engine, 0);
    }
    if (serializedProperties) {
      for (const key of Object.keys(serializedProperties)) {
        const value = serializedData[key as keyof spec.EffectsObjectData];

        if (value === undefined) {
          continue;
        }

        const propertyType = serializedProperties[key].type;

        // FIXME: taggedProperties 为 readonly，这里存在强制赋值
        // @ts-expect-error
        effectsObject[key as keyof EffectsObject] = await SerializationHelper.deserializePropertyAsync(value, engine, 0, propertyType);
      }
    }

    effectsObject.fromData(taggedProperties as spec.EffectsObjectData);
  }

  static checkTypedArray (obj: unknown): boolean {
    return obj instanceof Int8Array
      || obj instanceof Uint8Array
      || obj instanceof Uint8ClampedArray
      || obj instanceof Int16Array
      || obj instanceof Uint16Array
      || obj instanceof Int32Array
      || obj instanceof Uint32Array
      || obj instanceof Float32Array
      || obj instanceof Float64Array
      || obj instanceof ArrayBuffer;
  }

  // check value is { id: 7e69662e964e4892ae8933f24562395b }
  static checkDataPath (value: unknown): value is spec.DataPath {
    return !!(isObject(value)
      && Object.keys(value).length === 1
      && 'id' in value
      && isString(value.id)
      && value.id.length === 32);
  }

  // TODO 测试函数，2.0 上线后移除
  static checkGLTFNode (value: any): boolean {
    return isObject(value)
      && value.nodeIndex !== undefined
      && value.isJoint !== undefined;
  }

  static checkImageSource (value: HTMLCanvasElement): boolean {
    return isCanvas(value) || value instanceof HTMLImageElement;
  }

  private static deserializeProperty<T> (
    property: T,
    engine: Engine,
    level: number,
    type?: Constructor<{}>,
  ): any {
    if (level > 14) {
      console.error('The nested object layers of the serialized data exceed the maximum limit.');

      return;
    }
    // 加载并链接 DataPath 字段表示的 EffectsObject 引用。Class 对象 copy [key, value] 会丢失对象信息，因此只递归数组对象和普通 js Object 结构对象。
    if (isArray(property)) {
      const res = [];

      for (const value of property) {
        res.push(SerializationHelper.deserializeProperty(value, engine, level + 1, type));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (SerializationHelper.checkDataPath(property)) {
      return engine.assetLoader.loadGUID(property.id);
    } else if (isObject(property) && property.constructor === Object) {
      let res: Record<string, EffectsObject>;

      if (type) {
        res = new type();
      } else {
        res = {};
      }
      for (const key of Object.keys(property)) {
        res[key] = SerializationHelper.deserializeProperty(property[key], engine, level + 1);
      }

      return res;
    } else {
      return property;
    }
  }

  private static async deserializePropertyAsync<T> (
    property: T,
    engine: Engine,
    level: number,
    type?: Constructor<{}>,
  ): Promise<unknown> {
    if (level > 14) {
      console.error('The nested object layers of the serialized data exceed the maximum limit.');

      return;
    }
    if (isArray(property)) {
      const res = [];

      for (const value of property) {
        res.push(await SerializationHelper.deserializePropertyAsync(value, engine, level + 1, type));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (SerializationHelper.checkDataPath(property)) {
      const res = await engine.assetLoader.loadGUIDAsync(property.id);

      return res;
    } else if (isObject(property) && property.constructor === Object) {
      let res: Record<string, unknown>;

      if (type) {
        res = new type();
      } else {
        res = {};
      }
      for (const key of Object.keys(property)) {
        res[key] = await SerializationHelper.deserializePropertyAsync(property[key], engine, level + 1);
      }

      return res;
    } else {
      return property;
    }
  }

  private static serializeObjectProperty (
    objectProperty: Record<string, unknown>,
    serializedData: Record<string, unknown>,
    level: number,
  ) {
    if (level > 14) {
      console.error('The nested object layers of the serialized data exceed the maximum limit.');

      return;
    }
    if (!serializedData) {
      serializedData = {};
    }

    for (const key of Object.keys(objectProperty)) {
      const value = objectProperty[key];

      if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        SerializationHelper.checkTypedArray(objectProperty)
      ) {
        // TODO json 数据避免传 typedArray
        serializedData[key] = value;
      } else if (isArray(value)) {
        if (!serializedData[key]) {
          serializedData[key] = [];
        }
        SerializationHelper.serializeArrayProperty(
          value,
          serializedData[key] as unknown[],
          level + 1,
        );
      } else if (EffectsObject.is(value)) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[key] = { id: value.getInstanceId() };
      } else if (isObject(value)) {
        if (!serializedData[key]) {
          serializedData[key] = {};
        }
        SerializationHelper.serializeObjectProperty(
          value,
          serializedData[key] as Record<string, unknown>,
          level + 1,
        );
      }
    }
  }

  private static serializeArrayProperty (
    arrayProperty: unknown[],
    serializedData: unknown[],
    level: number,
  ) {
    if (level > 14) {
      console.error('The nested object layers of the serialized data exceed the maximum limit.');

      return;
    }
    if (!serializedData) {
      serializedData = [];
    }

    for (let i = 0; i < arrayProperty.length; i++) {
      const value = arrayProperty[i];

      if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        SerializationHelper.checkTypedArray(arrayProperty)
      ) {
        // TODO json 数据避免传 typedArray
        serializedData[i] = value;
      } else if (isArray(value)) {
        if (!serializedData[i]) {
          serializedData[i] = [];
        }
        SerializationHelper.serializeArrayProperty(
          value,
          serializedData[i] as unknown[],
          level + 1,
        );
      } else if (EffectsObject.is(value)) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[i] = { id: value.getInstanceId() };
      } else if (isObject(value)) {
        if (!serializedData[i]) {
          serializedData[i] = {};
        }
        SerializationHelper.serializeObjectProperty(
          value,
          serializedData[i] as Record<string, unknown>,
          level + 1,
        );
      }
    }
  }
}
