/**
 * 判断是否是 iOS 13.0 或者 iOS 16.5，此版本对 WebGL 支持有问题，需要降级
 * @returns
 */
export function isDowngradeIOS (): boolean {
  const iOSVersionRegex = /iPhone OS (\d+)_(\d+)/;
  const match = iOSVersionRegex.exec(navigator.userAgent);

  if (match) {
    return match[1] === '13' || (match[1] === '16' && match[2] === '5');
  }

  return false;
}

export function throwError (destroyedErrorMessage: string) {
  throw new Error(destroyedErrorMessage);
}

export function throwErrorPromise (destroyedErrorMessage: string) {
  return Promise.reject(destroyedErrorMessage);
}

export function handleThrowError<T> (target: T, propertyKey: string, descriptor: PropertyDescriptor) {
  // 保存原始方法
  const originalMethod = descriptor.value;

  // 替换原始方法
  descriptor.value = async function (...args: any[]) {
    try {
      // 调用原始方法
      const result = await originalMethod.apply(this, args);

      return result;
    } catch (e: any) {
      // @ts-expect-error
      target.handleThrowError.call(this, e);
    }
  };

  // 返回修改后的描述符
  return descriptor;
}
