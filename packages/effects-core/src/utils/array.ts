import type { TypedArray } from '@galacean/effects-specification';

export function addItem<T> (arr: T[], value: T): T[] {
  if (!arr.includes(value)) {
    arr.push(value);
  }

  return arr;
}

/**
 * 性能测试：https://blog.mutoe.com/2019/compare-filter-vs-splice-in-javascript/
 * @param arr
 * @param value
 * @returns
 */
export function removeItem<T> (arr: T[], value: T): T[] {
  const index = arr.indexOf(value);

  if (index > -1) {
    arr.splice(index, 1);
  }

  return arr;
}

/**
 * 原 arrAddWithOrder 根据property的大小在arr中插入item
 * @param arr
 * @param item
 * @param property
 * @param descending
 * @returns
 */
export function addItemWithOrder<T extends Record<string, any>> (arr: T[], item: T, property: string, descending = false) {
  if (arr.includes(item)) {
    return;
  }
  arr.push(item);
  if (arr.length === 1) {
    return;
  }
  //单次插入排序
  let index = arr.length - 1;

  if (index) {
    const currentItem = arr[index];

    if (descending) {
      while (arr[index - 1][property] < currentItem[property]) {
        arr[index] = arr[index - 1];
        index--;
        if (index === 0) {
          break;
        }
      }
    } else {
      while (arr[index - 1][property] > currentItem[property]) {
        arr[index] = arr[index - 1];
        index--;
        if (index === 0) {
          break;
        }
      }
    }
    arr[index] = currentItem;
  }
}

export function enlargeBuffer<T extends TypedArray> (typeArray: T, length: number, increase = 1, maxSize: number): T {
  const buffer = typeArray.buffer;

  if (buffer.byteLength < typeArray.BYTES_PER_ELEMENT * length) {
    let size = Math.ceil(length * increase);

    if (!isNaN(maxSize)) {
      size = Math.min(size, maxSize);
    }
    const nbuffer = new ArrayBuffer(typeArray.BYTES_PER_ELEMENT * size);
    const nArr = new (typeArray.constructor as { new(buffer: ArrayBuffer): T })(nbuffer);

    nArr.set(typeArray);

    return nArr;
  }

  return typeArray;
}
