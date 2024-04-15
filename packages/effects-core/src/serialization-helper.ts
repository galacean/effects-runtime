import { getMergedStore } from './decorators';
import type { EffectsObjectData, DataPath } from './asset-loader';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';

export class SerializationHelper {
  static collectSerializableObject (effectsObject: EffectsObject, res: Record<string, EffectsObject>) {
    if (res[effectsObject.getInstanceId()]) {
      return;
    }
    effectsObject.toData();
    res[effectsObject.getInstanceId()] = effectsObject;
    const serializedProperties = getMergedStore(effectsObject);

    for (const key of Object.keys(serializedProperties)) {
      // TODO 待移除，序列化属性通过 effectsObject 对象直接获取
      let value = effectsObject.taggedProperties[key];

      if (value === undefined) {
        value = effectsObject[key as keyof EffectsObject];
      }

      if (value instanceof EffectsObject) {
        this.collectSerializableObject(value, res);
      } else if (value instanceof Array) {
        for (const arrayValue of value) {
          if (arrayValue instanceof EffectsObject) {
            this.collectSerializableObject(arrayValue, res);
          }
        }
      } else if (value instanceof Object) {
        // 非 EffectsObject 对象只递归一层
        for (const objectKey of Object.keys(value)) {
          const objectValue = value[objectKey];

          if (objectValue instanceof EffectsObject) {
            this.collectSerializableObject(objectValue, res);
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
      SerializationHelper.serializeTaggedProperties(serializeObject, serializedDatas[serializeObject.getInstanceId()]);
    }

    return serializedDatas;
  }

  static serializeTaggedProperties (effectsObject: EffectsObject, serializedData?: Record<string, any>) {
    effectsObject.toData();
    if (!serializedData) {
      serializedData = {};
    }
    const serializedProperties = getMergedStore(effectsObject);

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
      } else if (value instanceof Array) {
        if (!serializedData[key]) {
          serializedData[key] = [];
        }
        SerializationHelper.serializeArrayProperty(value, serializedData[key], 0);
      } else if (value instanceof EffectsObject) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[key] = { id: value.getInstanceId() };
      } else if (value instanceof Object) {
        if (!serializedData[key]) {
          serializedData[key] = {};
        }
        SerializationHelper.serializeObjectProperty(value, serializedData[key], 0);
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
      } else if (value instanceof Array) {
        if (!serializedData[key]) {
          serializedData[key] = [];
        }
        SerializationHelper.serializeArrayProperty(value, serializedData[key], 0);
      } else if (value instanceof EffectsObject) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[key] = { id: value.getInstanceId() };
      } else if (value instanceof Object) {
        if (!serializedData[key]) {
          serializedData[key] = {};
        }
        SerializationHelper.serializeObjectProperty(value, serializedData[key], 0);
      }
    }

    return serializedData;
  }

  static deserializeTaggedProperties (serializedData: Record<string, any>, effectsObject: EffectsObject) {
    const taggedProperties = effectsObject.taggedProperties;
    const serializedProperties = getMergedStore(effectsObject);
    const engine = effectsObject.engine;

    for (const key of Object.keys(serializedData)) {
      if (serializedProperties[key]) {
        continue;
      }
      const value = serializedData[key];

      taggedProperties[key] = SerializationHelper.deserializeProperty(value, engine, 0);
    }
    for (const key of Object.keys(serializedProperties)) {
      const value = serializedData[key];

      if (value === undefined) {
        continue;
      }

      // FIXME: taggedProperties 为 readonly，这里存在强制赋值
      // @ts-expect-error
      effectsObject[key as keyof EffectsObject] = SerializationHelper.deserializeProperty(value, engine, 0);
    }
    effectsObject.fromData(taggedProperties as EffectsObjectData);
  }

  static async deserializeTaggedPropertiesAsync (serializedData: Record<string, any>, effectsObject: EffectsObject) {
    const taggedProperties = effectsObject.taggedProperties;
    const serializedProperties = getMergedStore(effectsObject);
    const engine = effectsObject.engine;

    for (const key of Object.keys(serializedData)) {
      if (serializedProperties[key]) {
        continue;
      }
      const value = serializedData[key];

      taggedProperties[key] = await SerializationHelper.deserializePropertyAsync(value, engine, 0);
    }
    for (const key of Object.keys(serializedProperties)) {
      const value = serializedData[key];

      if (value === undefined) {
        continue;
      }

      // FIXME: taggedProperties 为 readonly，这里存在强制赋值
      // @ts-expect-error
      effectsObject[key as keyof EffectsObject] = await SerializationHelper.deserializePropertyAsync(value, engine, 0);
    }
    effectsObject.fromData(taggedProperties as EffectsObjectData);
  }

  static checkTypedArray (obj: any): boolean {
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

  static checkDataPath (value: any): boolean {
    // check value is { id: 7e69662e964e4892ae8933f24562395b }
    return value instanceof Object &&
      Object.keys(value).length === 1 &&
      value.id &&
      value.id.length === 32;
  }

  // TODO 测试函数，2.0 上线后移除
  static checkGLTFNode (value: any) {
    return value instanceof Object &&
      value.nodeIndex !== undefined &&
      value.isJoint !== undefined;
  }

  private static deserializeProperty<T> (property: T, engine: Engine, level: number): any {
    if (level > 14) {
      console.error('序列化数据的内嵌对象层数大于上限');

      return;
    }
    if (
      typeof property === 'number' ||
      typeof property === 'string' ||
      typeof property === 'boolean'
    ) {
      return property;
    } else if (property instanceof Array) {
      const res = [];

      for (const value of property) {
        res.push(SerializationHelper.deserializeProperty(value, engine, level + 1));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (SerializationHelper.checkDataPath(property)) {
      return engine.assetLoader.loadGUID((property as DataPath).id);
    } else if (property instanceof EffectsObject ||
      SerializationHelper.checkTypedArray(property) ||
      SerializationHelper.checkGLTFNode(property)) {
      return property;
    } else if (property instanceof Object) {
      const res: Record<string, any> = {};

      for (const key of Object.keys(property)) {
        // @ts-expect-error
        res[key] = SerializationHelper.deserializeProperty(property[key], engine, level + 1);
      }

      return res;
    }
  }

  private static async deserializePropertyAsync<T> (property: T, engine: Engine, level: number): Promise<any> {
    if (level > 14) {
      console.error('序列化数据的内嵌对象层数大于上限');

      return;
    }
    if (typeof property === 'number' ||
      typeof property === 'string' ||
      typeof property === 'boolean') {
      return property;
    } else if (property instanceof Array) {
      const res = [];

      for (const value of property) {
        res.push(await SerializationHelper.deserializePropertyAsync(value, engine, level + 1));
      }

      return res;
      // TODO json 数据避免传 typedArray
    } else if (SerializationHelper.checkDataPath(property)) {
      const res = await engine.assetLoader.loadGUIDAsync((property as DataPath).id);

      return res;
    } else if (property instanceof EffectsObject ||
      SerializationHelper.checkTypedArray(property) ||
      SerializationHelper.checkGLTFNode(property)) {
      return property;
    } else if (property instanceof Object) {
      const res: Record<string, any> = {};

      for (const key of Object.keys(property)) {
        // @ts-expect-error
        res[key] = await SerializationHelper.deserializePropertyAsync(property[key], engine, level + 1);
      }

      return res;
    }
  }

  private static serializeObjectProperty (objectProperty: Record<string, any>, serializedData: Record<string, any>, level: number): any {
    if (level > 14) {
      console.error('序列化数据的内嵌对象层数大于上限');

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
      } else if (value instanceof Array) {
        if (!serializedData[key]) {
          serializedData[key] = [];
        }
        SerializationHelper.serializeArrayProperty(value, serializedData[key], level + 1);
      } else if (value instanceof EffectsObject) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[key] = { id: value.getInstanceId() };
      } else if (value instanceof Object) {
        if (!serializedData[key]) {
          serializedData[key] = {};
        }
        SerializationHelper.serializeObjectProperty(value, serializedData[key], level + 1);
      }
    }
  }

  private static serializeArrayProperty (arrayProperty: Array<any>, serializedData: Array<any>, level: number): any {
    if (level > 14) {
      console.error('序列化数据的内嵌对象层数大于上限');

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
      } else if (value instanceof Array) {
        if (!serializedData[i]) {
          serializedData[i] = [];
        }
        this.serializeArrayProperty(value, serializedData[i], level + 1);
      } else if (value instanceof EffectsObject) {
        // TODO 处理 EffectsObject 递归序列化
        serializedData[i] = { id: value.getInstanceId() };
      } else if (value instanceof Object) {
        if (!serializedData[i]) {
          serializedData[i] = {};
        }
        SerializationHelper.serializeObjectProperty(value, serializedData[i], level + 1);
      }
    }
  }
}
