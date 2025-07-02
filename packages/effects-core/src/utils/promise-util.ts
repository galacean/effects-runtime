/**
 * Simple implementation of the deferred pattern.
 * An object that exposes a promise and functions to resolve and reject it.
 */
export class Deferred<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (err?: any) => void;

  promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}
