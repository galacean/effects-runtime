import { v4 as uuidv4 } from 'uuid';

export * from './array';
export * from './color';
export * from './device';
export * from './image-data';
export * from './sortable';
export * from './asserts';
export * from './text';
export * from './logger';

export type Immutable<O> = O extends Record<any, any>
  ? { readonly [key in keyof O]: Immutable<O[key]> }
  : O extends Array<infer X> ? ReadonlyArray<X> : O;

export type PickEnum<T, K extends T> = {
  [P in keyof K]: P extends K ? P : never;
};

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
 * @param obj - 要判断的对象
 * @return
 */
export function isString (obj: unknown): obj is string {
  return typeof obj === 'string';
}

/**
 * 判断对象是否是`Array`类型
 *
 * @static
 * @function isArray
 * @param obj - 要判断的对象
 * @return
 */
export const isArray = (Array.isArray || function (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
});

/**
 * 判断对象是否是函数类型
 *
 * @static
 * @function isFunction
 * @param obj - 要判断的对象
 * @return
 */
export function isFunction (obj: unknown) {
  return Object.prototype.toString.call(obj) === '[object Function]';
}

/**
 * 判断对象是否是`Object`类型
 *
 * @static
 * @function isObject
 * @param obj - 要判断的对象
 * @return
 */
export function isObject (obj: unknown): obj is Record<string | symbol, unknown> {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

export function isCanvas (canvas: HTMLCanvasElement) {
  // 小程序 Canvas 无法使用 instanceof HTMLCanvasElement 判断
  return typeof canvas === 'object' && canvas !== null && canvas.tagName?.toUpperCase() === 'CANVAS';
}

/**
 * 生成一个位于 min 和 max 之间的随机数
 * @param min
 * @param max
 * @returns
 */
export function randomInRange (min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function throwDestroyedError () {
  throw new Error('Destroyed item cannot be used again.');
}

export function generateGUID (): string {
  return uuidv4().replace(/-/g, '');
}

export function base64ToFile (
  base64: string,
  filename = 'base64File',
  contentType = '',
) {
  // 去掉 Base64 字符串的 Data URL 部分（如果存在）
  const base64WithoutPrefix = base64.split(',')[1] || base64;

  // 将 base64 编码的字符串转换为二进制字符串
  const byteCharacters = atob(base64WithoutPrefix);
  // 创建一个 8 位无符号整数值的数组，即“字节数组”
  const byteArrays = [];

  // 切割二进制字符串为多个片段，并将每个片段转换成一个字节数组
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    byteArrays.push(byteArray);
  }

  // 使用字节数组创建 Blob 对象
  const blob = new Blob(byteArrays, { type: contentType });

  // 创建 File 对象
  const file = new File([blob], filename, { type: contentType });

  return file;
}
