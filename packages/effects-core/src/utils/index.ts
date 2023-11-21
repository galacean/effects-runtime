import type * as spec from '@galacean/effects-specification';

export * from './array';
export * from './color';
export * from './device';
export * from './image-data';
export * from './sortable';
export * from './asserts';
export * from './timeline-component';

export type Immutable<O> = O extends Record<any, any>
  ? { readonly [key in keyof O]: Immutable<O[key]> }
  : O extends Array<infer X> ? ReadonlyArray<X> : O;

export enum DestroyOptions {
  destroy = 0,
  keep = 1,
  force = destroy,
}

/**
 *
 */
export interface Disposable {
  dispose (): void,
}

export interface RestoreHandler {
  restore (): void,
}

export interface LostHandler {
  lost (e: Event): void,
}

export function noop () {
}

/**
 * 判断对象是否是`String`类型
 *
 * @static
 * @function isString
 * @param {object} obj - 要判断的对象
 * @return {boolean}
 */
export function isString (obj: any) {
  return typeof obj === 'string';
}

/**
 * 判断对象是否是`Array`类型
 *
 * @static
 * @function isArray
 * @param {object} obj - 要判断的对象
 * @return {boolean}
 */
export const isArray = (Array.isArray || function (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
});

/**
 * 判断对象是否是函数类型
 *
 * @static
 * @function isFunction
 * @param {object} obj - 要判断的对象
 * @return {boolean}
 */
export function isFunction (obj: any) {
  return Object.prototype.toString.call(obj) === '[object Function]';
}

/**
 * 判断对象是否是`Object`类型
 *
 * @static
 * @function isObject
 * @param {object} obj - 要判断的对象
 * @return {boolean}
 */
export function isObject (obj: any) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

export function deepClone (obj: any): any {
  if (isArray(obj)) {
    return obj.map(deepClone);
  } else if (obj && typeof obj === 'object') {
    if (ArrayBuffer.isView(obj)) {
      return (obj as spec.TypedArray).slice();
    }
    const ret: Record<string, any> = {};
    const kas = Object.keys(obj);

    for (let i = 0; i < kas.length; i++) {
      const key = kas[i];

      ret[key] = deepClone(obj[key]);
    }

    return ret;
  }

  return obj;
}

// TODO: 改名
export function random (min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function throwDestroyedError () {
  throw Error('destroyed item cannot be used again');
}
