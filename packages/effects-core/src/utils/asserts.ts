export function assertExist <T> (item: T | void | undefined | null, msg = 'item doesn\'t exist'): asserts item is T {
  if (item === undefined || item === null) {
    throw new Error(msg);
  }
}

export function asserts (condition: any, msg = 'asserts failed'): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}
