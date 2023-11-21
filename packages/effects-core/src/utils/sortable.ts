export interface Sortable {
  readonly priority: number,
}

export enum OrderType {
  none = 1,
  ascending = 2,
  descending = 3
}

/**
 * 按照指定排序方式对数组排序
 * @param arr - 要排序的数组
 * @param order - 排序方式
 * @returns
 */
export function sortByOrder<T extends Sortable> (arr: T[], order = OrderType.ascending): T[] {
  const length = arr.length;

  if (length <= 1 || order === OrderType.none) {
    return arr;
  }
  if (length <= 30) {
    for (let i = 1; i < length; i++) {
      insertionSort(arr, i, order);
    }

    return arr;
  } else {
    return fastSort(arr, order);
  }
}

/**
 * 按照指定排序方式往Sortable数组中添加成员
 * @param arr - 被添加的数组
 * @param item - 要添加的成员
 * @param order - 排序方式
 * @returns
 */
export function addByOrder<T extends Sortable> (arr: T[], item: T, order: OrderType = OrderType.ascending): T[] {
  if (arr.includes(item)) {
    return arr;
  }
  arr.push(item);
  if (arr.length === 1) {
    return arr;
  }
  if (order !== OrderType.none) {
    insertionSort(arr, arr.length - 1, order);
  }

  return arr;
}

function insertionSort<T extends Sortable> (array: T[], index: number, order: OrderType) {
  const currentItem = array[index];

  if (order !== OrderType.ascending) {
    while (index >= 1 && array[index - 1].priority < currentItem.priority) {
      array[index] = array[index - 1];
      index--;
      if (index === 0) {
        break;
      }
    }
  } else {
    while (index >= 1 && array[index - 1].priority > currentItem.priority) {
      array[index] = array[index - 1];
      index--;
      if (index === 0) {
        break;
      }
    }
  }
  array[index] = currentItem;
}

function fastSort<T extends Sortable> (
  arr: T[],
  order: OrderType,
  start = 0,
  end = arr.length - 1,
): T[] {
  // 终止条件
  if (start >= end) {
    return arr;
  }

  const base = arr[start];
  let left = start;
  let right = end;

  while (left < right) {
    if (order === OrderType.ascending) {
      // 从右向左，寻找第一个小于base的值
      while (arr[right].priority > base.priority && right >= left) { right--; }
      // 从左向右，寻找第一个大于base的值
      while (arr[left].priority <= base.priority && left < right) { left++; }
    } else {
      // 从右向左，寻找第一个大于base的值
      while (arr[right].priority < base.priority && right >= left) { right--; }
      // 从左向右，寻找第一个小于base的值
      while (arr[left].priority >= base.priority && left < right) { left++; }
    }
    // 将两个值交换位置
    [arr[left], arr[right]] = [arr[right], arr[left]];
  }
  // 将最后两个游标相遇的位置的值与base值交换
  [arr[start], arr[left]] = [arr[left], arr[start]];
  fastSort(arr, order, start, left - 1);
  fastSort(arr, order, right + 1, end);

  return arr;
}
