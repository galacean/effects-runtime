/* eslint-disable no-prototype-builtins */
import { isArray, isObject } from '@galacean/effects';

export function deepMerge (target: any, args?: any) {
  if (!isObject(target) && !isArray(target)) {
    return target;
  }
  const result = isArray(target) ? [...target] : { ...target };
  const length = arguments.length;

  for (let index = 1; index < length; index++) {
    const source = arguments[index] || {};

    if (isObject(source)) {
      let prop;

      for (prop in source) {
        if (source.hasOwnProperty(prop)) {
          if (isObject(result[prop]) && isObject(source[prop])) {
            result[prop] = deepMerge(result[prop], source[prop]);
          } else if (isObject(source[prop])) {
            result[prop] = deepMerge(source[prop]);
          } else if (isArray(source[prop])) {
            result[prop] = deepMerge(source[prop]);
          } else {
            result[prop] = source[prop];
          }
        }
      }
      for (prop in result) {
        if (
          isObject(result[prop]) &&
          result.hasOwnProperty(prop) &&
          !source.hasOwnProperty(prop)
        ) {
          result[prop] = deepMerge(result[prop]);
        }
      }
    }
  }
  if (length === 1) {
    for (const prop in result) {
      if (isObject(result[prop]) && result.hasOwnProperty(prop)) {
        result[prop] = deepMerge(result[prop]);
      }
    }
  }

  return result;
}
