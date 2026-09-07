import type * as spec from '@galacean/effects-specification';
import type { EffectsObject } from './effects-object';
import { isCanvas, isObject, isString } from './utils';

export class SerializationHelper {
  static serialize (effectsObject: EffectsObject) {
    effectsObject.toData();

    return effectsObject.definition;
  }

  static deserialize (
    serializedData: spec.EffectsObjectData,
    effectsObject: EffectsObject,
  ) {
    effectsObject.definition = serializedData;
    effectsObject.fromData(serializedData);
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
      && isString(value.id));
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
}
